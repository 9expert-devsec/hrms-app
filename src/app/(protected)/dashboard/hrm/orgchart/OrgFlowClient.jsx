// src/app/(protected)/dashboard/hrm/orgchart/OrgFlowClient.jsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
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
import { Download, Search } from "lucide-react";

/* ================================================================
   Constants & Helpers
   ================================================================ */
const elk = new ELK();

const NODE_SIZES = {
  ceo:     { width: 280, height: 100 },
  coo:     { width: 280, height: 100 },
  dept:    { width: 200, height: 72  },
  head:    { width: 240, height: 88  },
  member:  { width: 200, height: 72  },
  default: { width: 200, height: 72  },
};

const getNodeSize = (type) => NODE_SIZES[type] || NODE_SIZES.default;

/* Shorthand for render (w/h) */
const SIZE = {
  ceo:    { w: 280, h: 100 },
  coo:    { w: 280, h: 100 },
  dept:   { w: 200, h: 72  },
  head:   { w: 240, h: 88  },
  member: { w: 200, h: 72  },
};

const tagColor = (hex, fb = "#2486FF") =>
  /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex || "") ? hex : fb;

const fullName = (e) =>
  [e.firstName, e.lastName].filter(Boolean).join(" ") || e.nickName || "-";

const initials = (e) => {
  const f = (e.firstName || "")[0] || "";
  const l = (e.lastName || "")[0] || "";
  return (f + l).toUpperCase() || "?";
};

const avatar = (u) =>
  !u
    ? null
    : u.startsWith("http") || u.startsWith("data:")
    ? u
    : u.startsWith("/")
    ? u
    : `/${u}`;

const profileUrl = (id) => `/dashboard/hrm/employee-profile?id=${id}`;

/* ================================================================
   Custom Nodes
   ================================================================ */

/* ---------- Avatar helper ---------- */
function AvatarCircle({ photoUrl, emp, size, ringColor, bgColor, textColor, fontSize }) {
  const src = avatar(photoUrl);
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: 9999,
        border: `2px solid ${ringColor}`,
        overflow: "hidden",
        background: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: "cover", width: size, height: size }}
        />
      ) : (
        <span style={{ color: textColor, fontWeight: 700, fontSize: fontSize || 14 }}>
          {emp ? initials(emp) : "?"}
        </span>
      )}
    </div>
  );
}

/* ---------- CEO Node ---------- */
function CEONode({ data }) {
  const highlighted = data._highlighted;
  return (
    <div
      onClick={() => data.empId && window.open(profileUrl(data.empId), "_self")}
      style={{
        width: SIZE.ceo.w,
        height: SIZE.ceo.h,
        background: "linear-gradient(135deg, #0D1B2A 0%, #1a3a5c 100%)",
        border: highlighted ? "2px solid #D4F73F" : "2px solid #D4F73F",
        borderRadius: 20,
        boxShadow: highlighted
          ? "0 0 0 4px rgba(212,247,63,0.3), 0 8px 32px rgba(13,27,42,0.35)"
          : "0 8px 32px rgba(13,27,42,0.35)",
        cursor: data.empId ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 14,
      }}
    >
      <AvatarCircle
        photoUrl={data.photoUrl}
        emp={data}
        size={56}
        ringColor="#D4F73F"
        bgColor="#2486FF"
        textColor="#FFFFFF"
        fontSize={18}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#D4F73F", marginTop: 2 }}>
          {data.position || "-"}
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: 4,
            background: "rgba(212,247,63,0.15)",
            color: "#D4F73F",
            borderRadius: 99,
            fontSize: 10,
            padding: "1px 8px",
          }}
        >
          {data.deptLabel || "Management"}
        </span>
      </div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

/* ---------- COO Node ---------- */
function COONode({ data }) {
  const highlighted = data._highlighted;
  return (
    <div
      onClick={() => data.empId && window.open(profileUrl(data.empId), "_self")}
      style={{
        width: SIZE.coo.w,
        height: SIZE.coo.h,
        background: "linear-gradient(135deg, #0D1B2A 0%, #1a3a5c 100%)",
        border: highlighted ? "2px solid #D4F73F" : "2px solid #2486FF",
        borderRadius: 20,
        boxShadow: highlighted
          ? "0 0 0 4px rgba(212,247,63,0.3), 0 8px 32px rgba(13,27,42,0.35)"
          : "0 8px 32px rgba(13,27,42,0.35)",
        cursor: data.empId ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 14,
      }}
    >
      <AvatarCircle
        photoUrl={data.photoUrl}
        emp={data}
        size={56}
        ringColor="#2486FF"
        bgColor="#2486FF"
        textColor="#FFFFFF"
        fontSize={18}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.name}
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#48B0FF", marginTop: 2 }}>
          {data.position || "-"}
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: 4,
            background: "rgba(36,134,255,0.15)",
            color: "#48B0FF",
            borderRadius: 99,
            fontSize: 10,
            padding: "1px 8px",
          }}
        >
          {data.deptLabel || "Management"}
        </span>
      </div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

/* ---------- Department Node ---------- */
function DeptNode({ data }) {
  const highlighted = data._highlighted;
  const bg = tagColor(data.color);
  return (
    <div
      style={{
        width: SIZE.dept.w,
        height: SIZE.dept.h,
        background: bg,
        borderRadius: 16,
        boxShadow: highlighted
          ? `0 0 0 4px rgba(212,247,63,0.3), 0 4px 16px ${bg}44`
          : `0 4px 16px ${bg}44`,
        border: highlighted ? "2px solid #D4F73F" : "2px solid transparent",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "0 14px",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span
          style={{
            background: "rgba(255,255,255,0.2)",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 6,
            padding: "1px 8px",
          }}
        >
          {data.code}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#FFFFFF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {data.name}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
        {data.memberCount ?? 0} คน
      </div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

/* ---------- Head / Manager Node ---------- */
function HeadNode({ data }) {
  const highlighted = data._highlighted;
  return (
    <div
      onClick={() => data.empId && window.open(profileUrl(data.empId), "_self")}
      style={{
        width: SIZE.head.w,
        height: SIZE.head.h,
        background: "#FFFFFF",
        border: highlighted ? "2px solid #D4F73F" : "1.5px solid #2486FF",
        borderRadius: 16,
        boxShadow: highlighted
          ? "0 0 0 4px rgba(212,247,63,0.3), 0 4px 12px rgba(36,134,255,0.15)"
          : "0 4px 12px rgba(36,134,255,0.15)",
        cursor: data.empId ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Left accent bar */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "#2486FF", borderRadius: "4px 0 0 4px" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px 0 18px", flex: 1, minWidth: 0 }}>
        <AvatarCircle
          photoUrl={data.photoUrl}
          emp={data}
          size={44}
          ringColor="#2486FF"
          bgColor="#EFF6FF"
          textColor="#2486FF"
          fontSize={14}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#0D1B2A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.name}
          </div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#2486FF", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {data.position || "-"}
          </div>
          <span
            style={{
              display: "inline-block",
              marginTop: 3,
              background: "#EFF6FF",
              color: "#2486FF",
              fontSize: 10,
              borderRadius: 99,
              padding: "1px 8px",
            }}
          >
            หัวหน้า
          </span>
        </div>
      </div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

/* ---------- Member Node ---------- */
function MemberNode({ data }) {
  const highlighted = data._highlighted;
  return (
    <div
      onClick={() => data.empId && window.open(profileUrl(data.empId), "_self")}
      style={{
        width: SIZE.member.w,
        height: SIZE.member.h,
        background: "#FFFFFF",
        border: highlighted ? "2px solid #D4F73F" : "1px solid rgba(36,134,255,0.12)",
        borderRadius: 12,
        boxShadow: highlighted
          ? "0 0 0 4px rgba(212,247,63,0.3), 0 2px 8px rgba(13,27,42,0.06)"
          : "0 2px 8px rgba(13,27,42,0.06)",
        cursor: data.empId ? "pointer" : "default",
        display: "flex",
        alignItems: "center",
        padding: "0 12px",
        gap: 10,
        transition: "border-color 200ms, box-shadow 200ms",
      }}
    >
      <AvatarCircle
        photoUrl={data.photoUrl}
        emp={data}
        size={36}
        ringColor="rgba(36,134,255,0.2)"
        bgColor="#F8FAFD"
        textColor="#5E6A7E"
        fontSize={12}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#0D1B2A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.name}
        </div>
        <div style={{ fontSize: 11, color: "#5E6A7E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.position || "-"}
        </div>
      </div>
      {data.level && (
        <span
          style={{
            background: "#F8FAFD",
            color: "#5E6A7E",
            fontSize: 10,
            borderRadius: 6,
            padding: "2px 6px",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          L{data.level}
        </span>
      )}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { ceo: CEONode, coo: COONode, dept: DeptNode, head: HeadNode, member: MemberNode };

/* ================================================================
   Graph Builder
   ================================================================ */
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
    if (String(d.code).toUpperCase() === "MD") continue;
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
      type: "ceo",
      data: {
        name: fullName(ceo),
        firstName: ceo.firstName,
        lastName: ceo.lastName,
        position: ceo.position,
        level: ceo.level,
        photoUrl: ceo.photoUrl,
        empId: String(ceo._id),
        deptLabel: "Management",
      },
      width: SIZE.ceo.w,
      height: SIZE.ceo.h,
    });
  }
  if (coo) {
    nodes.push({
      id: "coo",
      type: "coo",
      data: {
        name: fullName(coo),
        firstName: coo.firstName,
        lastName: coo.lastName,
        position: coo.position,
        level: coo.level,
        photoUrl: coo.photoUrl,
        empId: String(coo._id),
        deptLabel: "Management",
      },
      width: SIZE.coo.w,
      height: SIZE.coo.h,
    });
  }

  for (const g of groups) {
    const depId = `dep-${g.dept.code}`;
    const depColor = tagColor(g.dept.color);
    const memberCount = g.members.length + (g.head ? 1 : 0);

    nodes.push({
      id: depId,
      type: "dept",
      data: {
        id: depId,
        name: g.dept.name,
        code: g.dept.code,
        color: depColor,
        memberCount,
      },
      width: SIZE.dept.w,
      height: SIZE.dept.h,
    });

    // CEO → Department
    if (ceo)
      edges.push({
        id: `e-ceo-${depId}`,
        source: "ceo",
        target: depId,
        type: "smoothstep",
        style: { stroke: "#2486FF", strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#2486FF", width: 16, height: 16 },
      });

    // COO → Department (dashed)
    if (coo)
      edges.push({
        id: `e-coo-${depId}`,
        source: "coo",
        target: depId,
        type: "smoothstep",
        style: { stroke: "#48B0FF", strokeWidth: 1.5, strokeDasharray: "6 3" },
      });

    // Head
    if (g.head) {
      const headId = `head-${g.head._id}`;
      nodes.push({
        id: headId,
        type: "head",
        data: {
          parentDept: depId,
          name: fullName(g.head),
          firstName: g.head.firstName,
          lastName: g.head.lastName,
          position: g.head.position,
          level: g.head.level,
          photoUrl: g.head.photoUrl,
          empId: String(g.head._id),
        },
        width: SIZE.head.w,
        height: SIZE.head.h,
      });
      edges.push({
        id: `e-${depId}-${headId}`,
        source: depId,
        target: headId,
        type: "smoothstep",
        data: { parentDept: depId },
        style: { stroke: "#2486FF", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#2486FF", width: 14, height: 14 },
      });
    }

    // Members
    for (const m of g.members) {
      const memId = `mem-${m._id}`;
      nodes.push({
        id: memId,
        type: "member",
        data: {
          parentDept: depId,
          name: fullName(m),
          firstName: m.firstName,
          lastName: m.lastName,
          position: m.position,
          level: m.level,
          photoUrl: m.photoUrl,
          empId: String(m._id),
        },
        width: SIZE.member.w,
        height: SIZE.member.h,
      });
      edges.push({
        id: `e-${g.head ? `head-${g.head._id}` : depId}-${memId}`,
        source: g.head ? `head-${g.head._id}` : depId,
        target: memId,
        type: "smoothstep",
        data: { parentDept: depId },
        style: { stroke: "rgba(36,134,255,0.4)", strokeWidth: 1 },
        markerEnd: { type: MarkerType.ArrowClosed, color: "rgba(36,134,255,0.4)", width: 12, height: 12 },
      });
    }
  }

  return { nodes, edges };
}

/* ================================================================
   ELK Layout
   ================================================================ */
const safeNum = (v) => (typeof v === "number" && !isNaN(v) ? v : 0);

async function elkLayout(nodes, edges) {
  /* Build ELK nodes with guaranteed numeric dimensions from type lookup */
  const elkNodes = nodes.map((n) => {
    const s = getNodeSize(n.type);
    return { id: n.id, width: s.width, height: s.height };
  });
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
      "elk.spacing.nodeNode": "80",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
      "elk.padding": "[top=120,left=40,bottom=40,right=40]",
    },
    children: elkNodes,
    edges: elkEdges,
  };

  try {
    const { children } = await elk.layout(g);
    const posMap = new Map(children.map((c) => [c.id, c]));

    return nodes.map((n) => {
      const elkNode = posMap.get(n.id);
      return {
        ...n,
        position: {
          x: safeNum(elkNode?.x),
          y: safeNum(elkNode?.y),
        },
      };
    });
  } catch (err) {
    console.warn("ELK layout failed, using fallback grid:", err);
    return applyFallbackLayout(nodes);
  }
}

/* Fallback: simple layered grid if ELK fails */
function applyFallbackLayout(nodes) {
  const order = { ceo: 0, coo: 0, dept: 1, head: 2, member: 3 };
  const layers = {};
  for (const n of nodes) {
    const lvl = order[n.type] ?? 3;
    if (!layers[lvl]) layers[lvl] = [];
    layers[lvl].push(n);
  }
  return nodes.map((n) => {
    const lvl = order[n.type] ?? 3;
    const row = layers[lvl];
    const idx = row.indexOf(n);
    const totalWidth = row.length * 260;
    const startX = -totalWidth / 2;
    return {
      ...n,
      position: { x: startX + idx * 260, y: lvl * 160 },
    };
  });
}

/* ================================================================
   MiniMap node color
   ================================================================ */
const miniMapNodeColor = (node) => {
  if (node.type === "ceo") return "#D4F73F";
  if (node.type === "coo") return "#2486FF";
  if (node.type === "dept") return "#2486FF";
  if (node.type === "head") return "#EFF6FF";
  return "#F8FAFD";
};

/* ================================================================
   Inner Component
   ================================================================ */
function OrgFlowInner({ departments, employees }) {
  const graph = useMemo(
    () => makeGraph({ departments, employees }),
    [departments, employees]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [highlightId, setHighlightId] = useState(null);
  const highlightTimer = useRef(null);
  const rf = useReactFlow();
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  /* ---------- Initial layout ---------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      const laid = await elkLayout(graph.nodes, graph.edges);

      // Center CEO/COO at top
      const depXs = laid
        .filter((n) => n.id.startsWith("dep-"))
        .map((n) => safeNum(n.position.x))
        .sort((a, b) => a - b);
      const midX = safeNum(
        depXs.length >= 2
          ? (depXs[0] + depXs[depXs.length - 1]) / 2
          : depXs[0] || 0
      );

      for (const n of laid) {
        if (n.id === "ceo") n.position = { x: midX - SIZE.ceo.w - 24, y: 0 };
        if (n.id === "coo") n.position = { x: midX + 24, y: 0 };
      }

      if (!alive) return;
      setNodes(laid);
      setEdges(graph.edges);
      setTimeout(() => {
        try { rf.fitView({ padding: 0.15, includeHiddenNodes: true }); } catch {}
      }, 50);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  /* ---------- Highlight effect ---------- */
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...n.data, _highlighted: n.id === highlightId },
      }))
    );
  }, [highlightId, setNodes]);

  /* ---------- Search people list ---------- */
  const allPeople = useMemo(() => {
    const arr = [];
    for (const n of graph.nodes) {
      if (n.type === "ceo" || n.type === "coo" || n.type === "head" || n.type === "member") {
        arr.push({ id: n.id, label: n.data?.name || n.id });
      }
    }
    return arr.sort((a, b) => a.label.localeCompare(b.label, "th"));
  }, [graph.nodes]);

  const onSearch = useCallback(
    (value) => {
      if (!value) return;
      // match by node id or by name substring
      const node =
        rf.getNode(value) ||
        rf.getNodes().find((n) => n.data?.name?.toLowerCase().includes(value.toLowerCase()));
      if (!node) return;

      // highlight
      setHighlightId(node.id);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightId(null), 3000);

      // zoom to node
      setTimeout(() => {
        try {
          rf.fitView({
            nodes: [{ id: node.id }],
            padding: 0.5,
            maxZoom: 1.2,
            duration: 500,
          });
        } catch {}
      }, 50);
    },
    [rf]
  );

  /* ---------- Export PNG ---------- */
  const exportPNG = async () => {
    try {
      rf.fitView({ padding: 0.12, includeHiddenNodes: true });
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
    const el = containerRef.current;
    if (!el) return;
    const dataUrl = await htmlToImage.toPng(el, {
      cacheBust: true,
      backgroundColor: "#F8FAFD",
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "9expert-orgchart.png";
    a.click();
  };

  return (
    <div
      ref={containerRef}
      style={{ height: "80vh", background: "#F8FAFD", borderRadius: 20, overflow: "hidden", position: "relative" }}
    >
      {/* ── Toolbar ── */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "#FFFFFF",
          borderBottom: "1px solid rgba(36,134,255,0.10)",
          borderRadius: 16,
          padding: "12px 16px",
          boxShadow: "0 2px 8px rgba(13,27,42,0.08)",
        }}
      >
        {/* Search */}
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <Search size={14} color="#5E6A7E" style={{ position: "absolute", left: 10, pointerEvents: "none" }} />
          <input
            ref={searchRef}
            list="orgPeopleList"
            placeholder="ค้นหาชื่อ…"
            style={{
              width: 220,
              background: "#F8FAFD",
              border: "1px solid rgba(36,134,255,0.15)",
              borderRadius: 10,
              padding: "8px 14px 8px 30px",
              fontSize: 13,
              color: "#0D1B2A",
              outline: "none",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearch(e.currentTarget.value);
            }}
          />
          <datalist id="orgPeopleList">
            {allPeople.map((p) => (
              <option key={p.id} value={p.id} label={p.label} />
            ))}
          </datalist>
        </div>

        {/* Title */}
        <span style={{ fontSize: 14, fontWeight: 700, color: "#0D1B2A", whiteSpace: "nowrap" }}>
          9Expert Org Chart
        </span>

        {/* Export */}
        <button
          onClick={exportPNG}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#2486FF",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 10,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <Download size={14} />
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
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ zoom: 0.7 }}
        panOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#C7D8F5" variant={BackgroundVariant.Dots} gap={24} size={1} />
        <MiniMap
          pannable
          zoomable
          nodeColor={miniMapNodeColor}
          maskColor="rgba(248,250,253,0.8)"
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(36,134,255,0.15)",
            borderRadius: 12,
          }}
        />
        <Controls
          style={{
            background: "#FFFFFF",
            border: "1px solid rgba(36,134,255,0.15)",
            borderRadius: 12,
            boxShadow: "0 2px 8px rgba(13,27,42,0.08)",
          }}
        />
      </ReactFlow>
    </div>
  );
}

/* ================================================================
   Export with Provider
   ================================================================ */
export default function OrgFlowClient({ departments, employees }) {
  return (
    <ReactFlowProvider>
      <OrgFlowInner departments={departments} employees={employees} />
    </ReactFlowProvider>
  );
}
