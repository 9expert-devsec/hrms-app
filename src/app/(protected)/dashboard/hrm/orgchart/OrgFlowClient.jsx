// src/app/(protected)/dashboard/hrm/orgchart/OrgFlowClient.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  Handle,
  Position,
  useEdgesState,
  useNodesState,
  useReactFlow,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import * as htmlToImage from "html-to-image";

/* ----------------- constants & helpers ----------------- */
const elk = new ELK();
const NODE_W = 320;
const NODE_H = 84;
const GAP_X = 64;
const GAP_Y = 96;

const TOP_GAP = 60; // ระยะห่างบนสุด (เผื่อ CEO/COO)
const TOP_PAIR_GAP = 40; // ระยะห่างระหว่าง CEO กับ COO

const FIT_VIEW = {
  padding: 0.06,           // เว้นขอบนิดหน่อย
  minZoom: 0.02,           // ยอมซูมออกได้เยอะขึ้น (สำหรับจอเล็ก)
  maxZoom: 1.4,            // ซูมเข้าได้พอประมาณ
  includeHiddenNodes: true
};

const tagColor = (hex, fb = "#64748b") =>
  /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex || "") ? hex : fb;

const fullName = (e) =>
  [e.firstName, e.lastName].filter(Boolean).join(" ") || e.nickName || "-";

const avatar = (u) =>
  !u
    ? "/avatar-default.png"
    : u.startsWith("http") || u.startsWith("data:")
    ? u
    : u.startsWith("/")
    ? u
    : `/${u}`;

const profileUrl = (id) =>
  // 👉 ถ้าเส้นทางโปรไฟล์จริงของโปรเจ็กต์ต่างจากนี้ ให้แก้ตรงนี้จุดเดียว
  `/dashboard/hrm/employee-profile?id=${id}`;

/* ----------------- custom nodes ----------------- */
function DeptNode({ data }) {
  const c = tagColor(data.color);
  return (
    <div
      style={{
        width: NODE_W,
        borderRadius: 16,
        background: "#0b1220",
        border: `2px solid ${c}`,
        boxShadow: `0 18px 40px -18px ${c}77`,
        color: "#fff",
        position: "relative",
      }}
    >
      {/* toggle collapse */}
      {/* <button
        onClick={(e) => {
          e.stopPropagation();
          data.onToggle?.(data.id);
        }}
        title={data.collapsed ? "Expand" : "Collapse"}
        className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white/90 text-slate-700 text-sm font-bold shadow"
      >
        {data.collapsed ? "+" : "–"}
      </button> */}

      <div
        style={{
          background: c,
          height: 36,
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          fontWeight: 600,
        }}
      >
        {data.name}
      </div>
      <div className="px-4 py-2 text-xs text-slate-300">
        Department • <span className="font-medium">{data.code}</span>
      </div>

      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

function PersonNode({ data }) {
  const isHead =
    data.role === "head" || data.role === "ceo" || data.role === "coo";
  const c = tagColor(data.deptColor || "#94a3b8");

  return (
    <div
      onClick={() => {
        if (data.empId) window.open(profileUrl(data.empId), "_self");
      }}
      title={data.empId ? "เปิดโปรไฟล์" : ""}
      style={{
        width: NODE_W,
        background: "#fff",
        borderRadius: 16,
        border: "1px solid rgba(148,163,184,.25)",
        boxShadow: isHead
          ? `0 18px 40px -18px ${c}77`
          : "0 8px 22px rgba(15,23,42,.15)",
        cursor: data.empId ? "pointer" : "default",
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 9999,
            overflow: "hidden",
            border: "1px solid rgba(148,163,184,.35)",
            background: "#f1f5f9",
          }}
        >
          <img
            src={avatar(data.photoUrl)}
            alt={data.name}
            width="40"
            height="40"
            style={{ objectFit: "cover" }}
          />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">
            {data.name}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {data.position || "-"} {data.level ? `• L${data.level}` : ""}
          </div>
        </div>
      </div>

      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { dept: DeptNode, person: PersonNode };

/* ----------------- graph builder ----------------- */
const pickCEO = (emps) =>
  emps.find((e) => /(^|\W)CEO(\W|$)/i.test(e.position || "")) ||
  [...emps].sort((a, b) => (b.level || 0) - (a.level || 0))[0] ||
  null;

const pickCOO = (emps) =>
  emps.find((e) => /(^|\W)COO(\W|$)/i.test(e.position || "")) || null;

function groupByDepartment(deps, emps) {
  const depById = new Map(deps.map((d) => [String(d._id), d]));
  const depByCode = new Map(deps.map((d) => [String(d.code), d]));
  const groups = [];

  for (const d of deps) {
    if (String(d.code).toUpperCase() === "MD") continue; // ซ่อน MD
    groups.push({ dept: d, members: [] });
  }
  for (const e of emps) {
    const byId = e.departmentId ? depById.get(String(e.departmentId)) : null;
    const byCode = e.department ? depByCode.get(String(e.department)) : null;
    const dept = byId || byCode;
    if (!dept) continue;
    const g = groups.find((gg) => String(gg.dept._id) === String(dept._id));
    if (g) g.members.push(e);
  }
  for (const g of groups) {
    const candidates = [...g.members].sort(
      (a, b) => (b.level || 0) - (a.level || 0)
    );
    g.head =
      candidates.find((m) =>
        /(manager|หัวหน้า|lead|head|director)/i.test(m.position || "")
      ) ||
      candidates[0] ||
      null;
    if (g.head)
      g.members = g.members.filter((m) => String(m._id) !== String(g.head._id));
  }
  return groups;
}

function makeGraph({ departments, employees }) {
  const ceo = pickCEO(employees);
  const coo = pickCOO(employees);
  const groups = groupByDepartment(departments, employees);

  const nodes = [];
  const edges = [];

  if (ceo) {
    nodes.push({
      id: "ceo",
      type: "person",
      data: {
        role: "ceo",
        name: fullName(ceo),
        position: ceo.position,
        level: ceo.level,
        photoUrl: ceo.photoUrl,
        empId: String(ceo._id),
      },
      width: NODE_W,
      height: NODE_H,
    });
  }
  if (coo) {
    nodes.push({
      id: "coo",
      type: "person",
      data: {
        role: "coo",
        name: fullName(coo),
        position: coo.position,
        level: coo.level,
        photoUrl: coo.photoUrl,
        empId: String(coo._id),
      },
      width: NODE_W,
      height: NODE_H,
    });
  }

  for (const g of groups) {
    const depId = `dep-${g.dept.code}`;
    const depColor = tagColor(g.dept.color);

    nodes.push({
      id: depId,
      type: "dept",
      data: {
        id: depId,
        name: g.dept.name,
        code: g.dept.code,
        color: depColor,
        collapsed: false,
        // toggle จะถูกอัดเพิ่มจากด้านนอกภายหลัง
      },
      width: NODE_W,
      height: NODE_H,
    });

    if (ceo)
      edges.push({
        id: `e-ceo-${depId}`,
        source: "ceo",
        target: depId,
        type: "smoothstep",
        style: { stroke: "#93a4b8", strokeWidth: 1.6 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#93a4b8",
          width: 18,
          height: 18,
        },
      });

    if (coo)
      edges.push({
        id: `e-coo-${depId}`,
        source: "coo",
        target: depId,
        type: "smoothstep",
        style: { stroke: "#a3e635", strokeWidth: 1.2, opacity: 0.55 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#a3e635",
          width: 14,
          height: 14,
        },
      });

    if (g.head) {
      const headId = `head-${g.head._id}`;
      nodes.push({
        id: headId,
        type: "person",
        data: {
          role: "head",
          parentDept: depId,
          deptColor: depColor,
          name: fullName(g.head),
          position: g.head.position,
          level: g.head.level,
          photoUrl: g.head.photoUrl,
          empId: String(g.head._id),
        },
        width: NODE_W,
        height: NODE_H,
      });
      edges.push({
        id: `e-${depId}-${headId}`,
        source: depId,
        target: headId,
        type: "smoothstep",
        data: { parentDept: depId },
        style: { stroke: depColor, strokeWidth: 1.6 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: depColor,
          width: 16,
          height: 16,
        },
      });
    }

    for (const m of g.members) {
      const memId = `mem-${m._id}`;
      nodes.push({
        id: memId,
        type: "person",
        data: {
          role: "member",
          parentDept: depId,
          deptColor: depColor,
          name: fullName(m),
          position: m.position,
          level: m.level,
          photoUrl: m.photoUrl,
          empId: String(m._id),
        },
        width: NODE_W,
        height: NODE_H,
      });
      edges.push({
        id: `e-${g.head ? `head-${g.head._id}` : depId}-${memId}`,
        source: g.head ? `head-${g.head._id}` : depId,
        target: memId,
        type: "smoothstep",
        data: { parentDept: depId },
        style: { stroke: depColor, strokeWidth: 1.2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: depColor,
          width: 14,
          height: 14,
        },
      });
    }
  }

  return { nodes, edges };
}

/* ----------------- ELK layout ----------------- */
async function elkLayout(nodes, edges) {
  const elkNodes = nodes.map((n) => ({
    id: n.id,
    width: n.width || NODE_W,
    height: n.height || NODE_H,
  }));
  const elkEdges = edges.map((e) => ({
    id: e.id,
    sources: [e.source],
    targets: [e.target],
  }));

  const g = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.spacing.nodeNode": `${GAP_X}`,
      "elk.layered.spacing.nodeNodeBetweenLayers": `${GAP_Y}`,
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.padding": `[top=${
        TOP_GAP + TOP_PAIR_GAP
      },left=40,bottom=40,right=40]`,
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const { children } = await elk.layout(g);
  const pos = new Map(children.map((c) => [c.id, { x: c.x, y: c.y }]));
  return nodes.map((n) => ({
    ...n,
    position: pos.get(n.id) || { x: 0, y: 0 },
  }));
}

/* ----------------- Inner ----------------- */
function OrgFlowInner({ departments, employees }) {
  const graph = useMemo(
    () => makeGraph({ departments, employees }),
    [departments, employees]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [collapsed, setCollapsed] = useState({}); // { depId: true }
  const rf = useReactFlow();
  const containerRef = useRef(null);

  // ฟังก์ชัน refit แบบที่เคยดีงาม
  const refit = (pad = 0.2) =>
    new Promise((res) => {
      setTimeout(() => {
        try {
          rf.fitView({ padding: pad, includeHiddenNodes: true });
        } catch {}
        res();
      }, 0);
    });

  // สร้าง layout ครั้งแรก
  useEffect(() => {
    let alive = true;
    (async () => {
      const laid = await elkLayout(graph.nodes, graph.edges);

      // จัด CEO/COO ให้อยู่กึ่งกลางแถวบนสุด
      const depXs = laid
        .filter((n) => n.id.startsWith("dep-"))
        .map((n) => n.position.x)
        .sort((a, b) => a - b);
      const midX =
        depXs.length >= 2
          ? (depXs[0] + depXs[depXs.length - 1]) / 2
          : depXs[0] || 0;

      for (const n of laid) {
        if (n.id === "ceo") {
          n.position = { x: midX - NODE_W - 24, y: 0 };
        }
        if (n.id === "coo") {
          n.position = { x: midX + 24, y: 0 };
        }
      }

      if (!alive) return;
      setNodes(laid);
      setEdges(graph.edges);
      await refit(0.18);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // inject onToggle & collapsed flag ลงใน dept nodes + ซ่อนลูกเมื่อ collapse
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.type === "dept") {
          return {
            ...n,
            data: {
              ...n.data,
              collapsed: !!collapsed[n.id],
              onToggle: (id) => setCollapsed((s) => ({ ...s, [id]: !s[id] })),
            },
          };
        }
        // ถ้าเป็นคน และอยู่ในแผนกที่พับอยู่ -> ซ่อน
        if (
          n.type === "person" &&
          n.data?.parentDept &&
          collapsed[n.data.parentDept]
        ) {
          return { ...n, hidden: true };
        }
        return { ...n, hidden: false };
      })
    );

    setEdges((prev) =>
      prev.map((e) => {
        const dep = e.data?.parentDept;
        if (dep && collapsed[dep]) return { ...e, hidden: true };
        return { ...e, hidden: false };
      })
    );
  }, [collapsed, setNodes, setEdges]);

  /* ---------- Search: zoom-to-node ---------- */
  const allPeople = useMemo(() => {
    const arr = [];
    for (const n of nodes) {
      if (n.type === "person") {
        arr.push({
          id: n.id,
          label: n.data?.name || n.id,
        });
      }
    }
    return arr.sort((a, b) => a.label.localeCompare(b.label, "th"));
  }, [nodes]);

  const onSearch = (value) => {
    const node = rf.getNode(value);
    if (!node) return;
    // ถ้าคนอยู่ในแผนกที่พับไว้ ให้คลายก่อน
    const dep = node.data?.parentDept;
    if (dep && collapsed[dep]) setCollapsed((s) => ({ ...s, [dep]: false }));
    setTimeout(() => {
      try {
        rf.fitView({
          nodes: [{ id: node.id }],
          padding: 0.06, // เว้นขอบนิดหน่อย
          minZoom: 0.02, // ยอมซูมออกได้เยอะขึ้น (สำหรับจอเล็ก)
          maxZoom: 1.4, // ซูมเข้าได้พอประมาณ
          includeHiddenNodes: true,
        });
      } catch {}
    }, 50);
  };

  /* ---------- Export PNG (fit ก่อน export) ---------- */
  const exportPNG = async () => {
    await refit(0.12);
    const el = containerRef.current;
    if (!el) return;
    const dataUrl = await htmlToImage.toPng(el, {
      cacheBust: true,
      backgroundColor: "#0a1220",
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "orgchart.png";
    a.click();
  };

  return (
    <div
      ref={containerRef}
      className="relative h-[78vh] rounded-2xl border border-white/10 overflow-hidden bg-[radial-gradient(#223,1px,transparent_1px)] [background-size:16px_16px]"
    >
      {/* Toolbar */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        {/* Search */}
        <div className="flex items-center gap-2 bg-white/90 rounded-lg px-2 py-1 text-slate-800 shadow">
          <input
            list="peopleList"
            placeholder="ค้นหาชื่อ…"
            className="px-2 py-1 text-sm bg-transparent outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch(e.currentTarget.value);
            }}
          />
          <button
            onClick={(e) => {
              const value = e.currentTarget.previousSibling.value;
              onSearch(value);
            }}
            className="text-sm px-2 py-1 rounded bg-slate-800 text-white"
          >
            Go
          </button>
          <datalist id="peopleList">
            {allPeople.map((p) => (
              <option key={p.id} value={p.id} label={p.label} />
            ))}
          </datalist>
        </div>

        {/* Export */}
        <button
          onClick={exportPNG}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-sm shadow"
          title="Export PNG"
        >
          Export PNG
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        minZoom={FIT_VIEW.minZoom}
        maxZoom={FIT_VIEW.maxZoom}
        panOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1f2937" gap={24} />
        <MiniMap pannable zoomable />
        <Controls position="bottom-left" />
      </ReactFlow>
    </div>
  );
}

/* ----------------- Export with Provider ----------------- */
export default function OrgFlowClient({ departments, employees }) {
  return (
    <ReactFlowProvider>
      <OrgFlowInner departments={departments} employees={employees} />
    </ReactFlowProvider>
  );
}
