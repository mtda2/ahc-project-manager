import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useMemo,
} from "react";
import {
  LayoutDashboard,
  Plus,
  Calendar,
  BarChart3,
  Users,
  Clock,
  ChevronRight,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  PenTool,
  Briefcase,
  Activity,
  ShieldCheck,
  MapPin,
  LogOut,
  Lock,
  Wallet,
  FileText,
  Bell,
  Search,
  Settings,
  Filter,
  MoreVertical,
  UserCircle,
  X,
  Edit2,
  Wifi,
  WifiOff,
  Cloud,
  MessageSquare,
  History,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// --- FIREBASE SETUP ---
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, onSnapshot } from "firebase/firestore";

// 🔴 CONFIG ของคุณ 🔴
const firebaseConfig = {
  apiKey: "AIzaSyBCOcoLsLQCUORMQRw8d41hXxf90ANqPKg",
  authDomain: "ahc-project-manager.firebaseapp.com",
  projectId: "ahc-project-manager",
  storageBucket: "ahc-project-manager.firebasestorage.app",
  messagingSenderId: "523595121122",
  appId: "1:523595121122:web:bdead327d0d6901b0479bb",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 1. Utilities ---

const cn = (...classes) => classes.filter(Boolean).join(" ");
const generateId = () => Math.random().toString(36).substr(2, 9);
const formatDate = (date) =>
  new Date(date).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
const formatTimeAgo = (dateString) => {
  const diff = (new Date() - new Date(dateString)) / 1000;
  if (diff < 60) return "เมื่อสักครู่";
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชั่วโมงที่แล้ว`;
  return formatDate(dateString);
};

// --- 2. State Management (Cloud Sync) ---

const ProjectContext = React.createContext();

const initialState = {
  projects: [],
  members: [],
  activities: [], // เพิ่ม State สำหรับเก็บประวัติ
  viewMode: "admin",
  loading: true,
  online: false,
};

const projectReducer = (state, action) => {
  switch (action.type) {
    case "SYNC_DATA":
      return {
        ...state,
        projects: action.payload.projects || [],
        members: action.payload.members || [],
        activities: action.payload.activities || [],
        loading: false,
        online: true,
      };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload };
    case "SET_OFFLINE":
      return { ...state, online: false };
    default:
      return state;
  }
};

const ProjectProvider = ({ children }) => {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  // --- Real-time Sync Engine ---
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "ahc_db", "main_data"),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          dispatch({ type: "SYNC_DATA", payload: data });
        } else {
          const initialData = { projects: [], members: [], activities: [] };
          setDoc(doc.ref, initialData);
          dispatch({ type: "SYNC_DATA", payload: initialData });
        }
      },
      (error) => {
        console.error("Firebase Sync Error:", error);
        dispatch({ type: "SET_OFFLINE" });
      }
    );
    return () => unsub();
  }, []);

  const saveToCloud = (newData) => {
    if (state.online) {
      setDoc(doc(db, "ahc_db", "main_data"), newData, { merge: true });
    }
  };

  // Helper สร้าง Log
  const createLog = (text, userRole) => ({
    id: generateId(),
    text,
    user: userRole === "admin" ? "Admin" : "Site User",
    timestamp: new Date().toISOString(),
  });

  const actions = {
    toggleViewMode: () =>
      dispatch({
        type: "SET_VIEW_MODE",
        payload: state.viewMode === "admin" ? "contractor" : "admin",
      }),

    createProject: (data) => {
      const newProject = {
        id: generateId(),
        ...data,
        createdAt: new Date().toISOString(),
        columns: [
          { id: "c1", name: "รอดำเนินการ", color: "bg-slate-100" },
          { id: "c2", name: "กำลังทำ", color: "bg-blue-50" },
          { id: "c3", name: "รอตรวจ", color: "bg-amber-50" },
          { id: "c4", name: "เสร็จสิ้น", color: "bg-emerald-50" },
        ],
        tasks: [],
        timeline: [],
      };
      // Add Log
      const newLog = createLog(
        `สร้างโครงการใหม่: ${data.name}`,
        state.viewMode
      );
      const newActivities = [newLog, ...state.activities].slice(0, 20); // Keep last 20

      saveToCloud({
        projects: [...state.projects, newProject],
        members: state.members,
        activities: newActivities,
      });
    },

    updateProject: (id, data, logMessage = null) => {
      const updatedProjects = state.projects.map((p) =>
        p.id === id ? { ...p, ...data } : p
      );

      let newActivities = state.activities;
      if (logMessage) {
        const newLog = createLog(logMessage, state.viewMode);
        newActivities = [newLog, ...state.activities].slice(0, 20);
      } else if (data.tasks) {
        // Auto log for tasks if specific message not provided
        const newLog = createLog(`อัปเดตงานในโครงการ`, state.viewMode);
        newActivities = [newLog, ...state.activities].slice(0, 20);
      }

      saveToCloud({
        projects: updatedProjects,
        members: state.members,
        activities: newActivities,
      });
    },

    addMember: (data) => {
      const updatedMembers = [...state.members, { id: generateId(), ...data }];
      const newLog = createLog(`เพิ่มสมาชิกทีม: ${data.name}`, state.viewMode);
      const newActivities = [newLog, ...state.activities].slice(0, 20);
      saveToCloud({
        projects: state.projects,
        members: updatedMembers,
        activities: newActivities,
      });
    },

    updateMember: (id, data) => {
      const updatedMembers = state.members.map((m) =>
        m.id === id ? { ...m, ...data } : m
      );
      saveToCloud({
        projects: state.projects,
        members: updatedMembers,
        activities: state.activities,
      });
    },

    deleteMember: (id) => {
      const updatedMembers = state.members.filter((m) => m.id !== id);
      saveToCloud({
        projects: state.projects,
        members: updatedMembers,
        activities: state.activities,
      });
    },
  };

  return (
    <ProjectContext.Provider value={{ ...state, ...actions }}>
      {children}
    </ProjectContext.Provider>
  );
};

// --- 3. UI Components ---

const Card = ({ children, className, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      "bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all",
      className
    )}
  >
    {children}
  </div>
);

const Badge = ({ children, color = "slate" }) => {
  const colors = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
    violet: "bg-violet-100 text-violet-700",
  };
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded text-xs font-bold",
        colors[color] || colors.slate
      )}
    >
      {children}
    </span>
  );
};

// --- Graph Components ---

const SCurveGraph = ({ timeline, startDate, endDate, height = 300 }) => {
  const data = useMemo(() => {
    if (!timeline?.length) return [];
    const points = [];
    const start = new Date(startDate);
    const end = endDate
      ? new Date(endDate)
      : new Date(new Date(start).setMonth(start.getMonth() + 12));
    let curr = new Date(start);
    curr.setDate(1);
    const totalW = timeline.reduce((a, b) => a + (b.weight || 0), 0) || 100;

    while (curr <= end || points.length < 2) {
      let planned = 0;
      let actual = 0;
      timeline.forEach((t) => {
        const tStart = new Date(t.start);
        const tEnd = new Date(t.end);
        const w = t.weight || 0;
        const p = t.progress || 0;
        if (curr >= tEnd) planned += w;
        else if (curr > tStart) {
          const totalDuration = tEnd - tStart;
          if (totalDuration > 0)
            planned += ((curr - tStart) / totalDuration) * w;
        }
        const earnedValue = (p / 100) * w;
        if (curr >= tEnd) actual += earnedValue;
        else if (curr > tStart) {
          const totalDuration = tEnd - tStart;
          if (totalDuration > 0)
            actual += ((curr - tStart) / totalDuration) * earnedValue;
        }
      });
      points.push({
        date: formatDate(curr),
        Planned: Math.min(100, Math.round((planned / totalW) * 100)),
        Actual: Math.min(100, Math.round((actual / totalW) * 100)),
      });
      curr.setMonth(curr.getMonth() + 1);
      if (curr > new Date(end.getFullYear() + 5, 1, 1)) break;
    }
    return points;
  }, [timeline, startDate, endDate]);

  if (!timeline || timeline.length === 0)
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        ยังไม่มีข้อมูล Timeline
      </div>
    );

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colPlan" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colAct" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#f1f5f9"
          />
          <XAxis dataKey="date" fontSize={10} stroke="#94a3b8" />
          <YAxis fontSize={10} stroke="#94a3b8" unit="%" />
          <RechartsTooltip
            contentStyle={{
              borderRadius: "8px",
              border: "none",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
          <Area
            type="monotone"
            dataKey="Planned"
            stroke="#3b82f6"
            fillOpacity={1}
            fill="url(#colPlan)"
            name="แผนงานสะสม"
            strokeWidth={2}
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="Actual"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colAct)"
            name="ผลงานจริง"
            strokeWidth={2}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const DonutProgress = ({ percent }) => {
  const data = [
    { name: "Done", value: percent },
    { name: "Left", value: 100 - percent },
  ];
  const COLORS = ["#10b981", "#f1f5f9"];
  return (
    <div className="h-32 w-32 relative mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={55}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-800">{percent}%</span>
        <span className="text-[10px] text-slate-400">COMPLETE</span>
      </div>
    </div>
  );
};

// --- Feature: Task Card (With Update Box) ---

const TaskCard = ({ task, project, members, updateProject }) => {
  const [note, setNote] = useState(task.note || "");

  // Sync state if prop changes
  useEffect(() => {
    setNote(task.note || "");
  }, [task.note]);

  const saveNote = () => {
    if (note !== task.note) {
      const newTasks = project.tasks.map((t) =>
        t.id === task.id ? { ...t, note } : t
      );
      updateProject(
        project.id,
        { tasks: newTasks },
        `อัปเดตงาน: ${task.title}`
      );
    }
  };

  const handleDelete = () => {
    if (window.confirm("ลบงานนี้?")) {
      updateProject(
        project.id,
        { tasks: project.tasks.filter((t) => t.id !== task.id) },
        `ลบงาน: ${task.title}`
      );
    }
  };

  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all group">
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-medium text-slate-800 line-clamp-2">
          {task.title}
        </p>
        <button
          onClick={handleDelete}
          className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Update/Issue Box */}
      <div className="mb-3">
        <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-1">
          <MessageSquare size={10} /> UPDATE / ISSUE
        </label>
        <textarea
          className="w-full text-xs bg-amber-50/50 border border-amber-100 rounded p-2 text-slate-700 placeholder-slate-400 focus:ring-1 focus:ring-amber-300 outline-none resize-none"
          rows={2}
          placeholder="ระบุความคืบหน้า/ปัญหา..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={saveNote}
        />
      </div>

      <div className="flex items-center justify-between border-t border-slate-50 pt-2">
        <div className="flex items-center gap-1">
          <UserCircle size={14} className="text-slate-400" />
          <select
            className="text-[10px] border-none bg-transparent text-slate-600 focus:ring-0 cursor-pointer max-w-[100px] truncate"
            value={task.assignee || ""}
            onChange={(e) => {
              const newTasks = project.tasks.map((t) =>
                t.id === task.id ? { ...t, assignee: e.target.value } : t
              );
              updateProject(
                project.id,
                { tasks: newTasks },
                `เปลี่ยนผู้รับผิดชอบงาน: ${task.title}`
              );
            }}
          >
            <option value="">User</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1">
          {project.columns.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                const newTasks = project.tasks.map((t) =>
                  t.id === task.id ? { ...t, columnId: c.id } : t
                );
                updateProject(
                  project.id,
                  { tasks: newTasks },
                  `ย้ายงาน: ${task.title} ไปที่ ${c.name}`
                );
              }}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                task.columnId === c.id
                  ? "bg-slate-800 scale-125"
                  : "bg-slate-200 hover:bg-blue-500"
              )}
              title={c.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const KanbanBoard = ({ project, members, updateProject }) => {
  return (
    <div className="flex h-full gap-4 overflow-x-auto pb-4 pt-2">
      {project.columns.map((col) => (
        <div key={col.id} className="w-72 flex-shrink-0 flex flex-col">
          <div className="flex justify-between items-center mb-3 px-2">
            <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">
              <span
                className={cn(
                  "w-2 h-2 rounded-full",
                  col.color.replace("bg-", "bg-slate-400 ")
                )}
              ></span>
              {col.name}
            </h3>
            <span className="bg-white px-2 rounded-full text-xs border text-slate-500 font-bold">
              {project.tasks.filter((t) => t.columnId === col.id).length}
            </span>
          </div>
          <div
            className={cn(
              "flex-1 rounded-xl p-2 border border-slate-100/50",
              col.color
            )}
          >
            <div className="space-y-2">
              {project.tasks
                .filter((t) => t.columnId === col.id)
                .map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    project={project}
                    members={members}
                    updateProject={updateProject}
                  />
                ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Feature: Construction Timeline ---

const TimelineTable = ({ project, updateProject, viewMode }) => {
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState(project.timeline || []);
  const isAdmin = viewMode === "admin";

  const wp = useMemo(() => {
    const totalW = data.reduce((a, b) => a + (b.weight || 0), 0) || 1;
    const earned = data.reduce(
      (a, b) => a + ((b.progress || 0) / 100) * (b.weight || 0),
      0
    );
    return Math.round((earned / totalW) * 100);
  }, [data]);

  const save = () => {
    updateProject(
      project.id,
      { timeline: data },
      "อัปเดตแผนงานก่อสร้าง (Timeline)"
    );
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 col-span-1 flex flex-col items-center justify-center relative overflow-hidden">
          <h3 className="text-slate-500 font-bold text-sm mb-4 uppercase tracking-wider">
            % Total Project Progress
          </h3>
          <DonutProgress percent={wp} />
          <div className="mt-6 w-full grid grid-cols-2 divide-x divide-slate-100 text-center">
            <div>
              <p className="text-xs text-slate-400">Total Phases</p>
              <p className="font-bold text-slate-700">{data.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Completed</p>
              <p className="font-bold text-emerald-600">
                {data.filter((d) => parseInt(d.progress) === 100).length}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6 col-span-2">
          <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
            <Activity size={18} /> S-Curve Analysis
          </h4>
          <SCurveGraph
            timeline={data}
            startDate={project.startDate}
            height={200}
          />
        </Card>
      </div>
      <div className="flex justify-between items-end px-1">
        <div>
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Briefcase size={20} /> รายการงวดงาน (BOQ)
          </h3>
          <p className="text-xs text-slate-500">
            จัดการความก้าวหน้าและแผนงานก่อสร้าง
          </p>
        </div>
        <div>
          {editing ? (
            <button
              onClick={save}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2 rounded-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 font-bold transition-all"
            >
              <CheckCircle2 size={18} /> บันทึกข้อมูล
            </button>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all font-medium shadow-sm"
            >
              <PenTool size={16} /> {isAdmin ? "แก้ไขแผนงาน" : "อัปเดตผลงาน"}
            </button>
          )}
        </div>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-xs">
            <tr>
              <th className="p-4">งวดงาน</th>
              <th className="p-4 text-center">กำหนดเสร็จ</th>
              <th className="p-4 text-center">น้ำหนัก (%)</th>
              <th className="p-4 w-1/3">ความคืบหน้า (Actual)</th>
              {editing && isAdmin && (
                <th className="p-4 text-center">จัดการ</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="p-4 font-medium text-slate-800">
                  {editing && isAdmin ? (
                    <input
                      className="border rounded px-2 py-1 w-full bg-slate-50"
                      value={row.title}
                      onChange={(e) => {
                        const n = [...data];
                        n[idx].title = e.target.value;
                        setData(n);
                      }}
                    />
                  ) : (
                    row.title
                  )}
                </td>
                <td className="p-4 text-center text-xs text-slate-500">
                  {editing && isAdmin ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px]">Start</span>
                      <input
                        type="date"
                        className="border rounded px-1"
                        value={row.start}
                        onChange={(e) => {
                          const n = [...data];
                          n[idx].start = e.target.value;
                          setData(n);
                        }}
                      />
                      <span className="text-[10px]">End</span>
                      <input
                        type="date"
                        className="border rounded px-1"
                        value={row.end}
                        onChange={(e) => {
                          const n = [...data];
                          n[idx].end = e.target.value;
                          setData(n);
                        }}
                      />
                    </div>
                  ) : (
                    <div>{row.end ? formatDate(row.end) : "-"}</div>
                  )}
                </td>
                <td className="p-4 text-center">
                  {editing && isAdmin ? (
                    <input
                      type="number"
                      className="border rounded px-1 w-16 text-center"
                      value={row.weight}
                      onChange={(e) => {
                        const n = [...data];
                        n[idx].weight = parseFloat(e.target.value);
                        setData(n);
                      }}
                    />
                  ) : (
                    <Badge color="blue">{row.weight}%</Badge>
                  )}
                </td>
                <td className="p-4">
                  {editing ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        min="0"
                        max="100"
                        value={row.progress}
                        onChange={(e) => {
                          const n = [...data];
                          n[idx].progress = e.target.value;
                          setData(n);
                        }}
                      />
                      <span className="text-sm font-bold w-10 text-right">
                        {row.progress}%
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all duration-500",
                            parseInt(row.progress) === 100
                              ? "bg-emerald-500"
                              : "bg-blue-500"
                          )}
                          style={{ width: `${row.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-500 w-8 text-right">
                        {row.progress}%
                      </span>
                    </div>
                  )}
                </td>
                {editing && isAdmin && (
                  <td className="p-4 text-center">
                    <button
                      onClick={() => setData(data.filter((_, i) => i !== idx))}
                      className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {editing && isAdmin && (
              <tr className="bg-blue-50/30 border-t border-dashed border-blue-200">
                <td colSpan={5} className="p-3 text-center">
                  <button
                    onClick={() =>
                      setData([
                        ...data,
                        {
                          title: "งวดงานใหม่",
                          start: "",
                          end: "",
                          weight: 10,
                          progress: 0,
                        },
                      ])
                    }
                    className="text-blue-600 text-xs font-bold flex items-center justify-center gap-2 w-full py-3 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Plus size={16} /> เพิ่มรายการงวดงาน (Add Phase)
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {data.length === 0 && !editing && (
          <div className="p-12 text-center text-slate-400">
            ยังไม่มีข้อมูล BOQ
          </div>
        )}
      </div>
    </div>
  );
};

// --- Feature: Members View ---

const MembersView = ({
  members,
  addMember,
  updateMember,
  deleteMember,
  setModals,
}) => {
  const [editingMember, setEditingMember] = useState(null);
  const getRoleBadgeColor = (role) => {
    if (role.includes("Manager") || role.includes("วิศวกร")) return "blue";
    if (role.includes("Owner") || role.includes("เจ้าของ")) return "violet";
    if (role.includes("Contractor") || role.includes("ผู้รับเหมา"))
      return "amber";
    return "slate";
  };
  const handleEditClick = (member) => {
    setEditingMember(member);
    setModals((m) => ({ ...m, member: true }));
  };
  const handleDeleteClick = (id) => {
    if (window.confirm("ยืนยันการลบสมาชิกนี้?")) deleteMember(id);
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            จัดการบุคลากร (Team Management)
          </h2>
          <p className="text-slate-500 text-sm">รายชื่อทีมงานและบทบาทหน้าที่</p>
        </div>
        <button
          onClick={() => {
            setEditingMember(null);
            setModals((m) => ({ ...m, member: true }));
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all font-bold flex items-center gap-2"
        >
          <Plus size={18} /> เพิ่มบุคลากร
        </button>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
            <tr>
              <th className="p-4 pl-6">ชื่อ-นามสกุล</th>
              <th className="p-4">ตำแหน่ง / บทบาท</th>
              <th className="p-4">ข้อมูลติดต่อ</th>
              <th className="p-4 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => (
              <tr
                key={m.id}
                className="hover:bg-slate-50/50 transition-colors group"
              >
                <td className="p-4 pl-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold border border-slate-200">
                    {m.name.charAt(0)}
                  </div>
                  <span className="font-bold text-slate-700">{m.name}</span>
                </td>
                <td className="p-4">
                  <Badge color={getRoleBadgeColor(m.role)}>{m.role}</Badge>
                </td>
                <td className="p-4 text-sm text-slate-500">{m.email || "-"}</td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditClick(m)}
                      className="p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg"
                      title="แก้ไข"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(m.id)}
                      className="p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg"
                      title="ลบ"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">
                  ยังไม่มีรายชื่อสมาชิก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editingMember && (
        <div
          className="hidden"
          id="edit-member-data"
          data-id={editingMember.id}
          data-name={editingMember.name}
          data-role={editingMember.role}
          data-email={editingMember.email}
        ></div>
      )}
    </div>
  );
};

// --- Feature: Dashboard ---

const DashboardView = ({
  projects,
  activities,
  setActiveProjectId,
  setModals,
}) => {
  const [selectedGraphId, setSelectedGraphId] = useState("");

  useEffect(() => {
    if (projects.length > 0 && !selectedGraphId) {
      setSelectedGraphId(projects[0].id);
    }
  }, [projects, selectedGraphId]);

  const selectedProject =
    projects.find((p) => p.id === selectedGraphId) || projects[0];

  const stats = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter(
        (p) => !p.timeline?.every((t) => parseInt(t.progress) === 100)
      ).length,
      delayed: projects.filter((p) =>
        p.timeline?.some(
          (t) => new Date(t.end) < new Date() && parseInt(t.progress) < 100
        )
      ).length,
    }),
    [projects]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Overview</h2>
          <p className="text-slate-500 text-sm">
            ยินดีต้อนรับสู่ศูนย์บัญชาการ AHC Project Management
          </p>
        </div>
        <button
          onClick={() => setModals((m) => ({ ...m, project: true }))}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all font-medium text-sm"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-blue-500">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Briefcase size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase font-bold">
              Total Projects
            </p>
            <h3 className="text-2xl font-bold">{stats.total}</h3>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-amber-500">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase font-bold">
              Active Sites
            </p>
            <h3 className="text-2xl font-bold">{stats.active}</h3>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-4 border-l-4 border-l-rose-500">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-xs uppercase font-bold">
              Delayed
            </p>
            <h3 className="text-2xl font-bold">{stats.delayed}</h3>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <Activity size={18} /> Project S-Curve
            </h3>
            <select
              className="border border-slate-200 rounded-lg text-sm px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedGraphId}
              onChange={(e) => setSelectedGraphId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
              {projects.length === 0 && <option>No Projects</option>}
            </select>
          </div>
          {selectedProject ? (
            <SCurveGraph
              timeline={selectedProject.timeline}
              startDate={selectedProject.startDate}
              height={280}
            />
          ) : (
            <div className="h-64 flex items-center justify-center bg-slate-50 rounded-xl text-slate-400">
              เลือกโครงการเพื่อดู S-Curve
            </div>
          )}
        </Card>
        <Card className="p-5 col-span-1">
          <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
            <History size={18} /> Recent Activity
          </h3>
          <div className="space-y-4">
            {activities.length > 0 ? (
              activities.slice(0, 5).map((log, i) => (
                <div
                  key={log.id || i}
                  className="flex gap-3 items-start border-b border-slate-50 pb-3 last:border-0"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-500">
                    {log.user ? log.user[0] : "U"}
                  </div>
                  <div>
                    <p className="text-sm text-slate-800 font-medium">
                      {log.text}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {formatTimeAgo(log.timestamp)} • โดย {log.user}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-400 text-sm py-4">
                ยังไม่มีกิจกรรมล่าสุด
              </div>
            )}
          </div>
        </Card>
      </div>

      <div>
        <h3 className="font-bold text-slate-800 mb-4 text-lg">
          โครงการทั้งหมด
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => {
            const prog = p.timeline?.length
              ? Math.round(
                  p.timeline.reduce(
                    (a, b) =>
                      a + (parseInt(b.progress || 0) * (b.weight || 0)) / 100,
                    0
                  )
                )
              : 0;
            return (
              <Card
                key={p.id}
                onClick={() => setActiveProjectId(p.id)}
                className="p-0 cursor-pointer group overflow-hidden border-t-4 border-t-slate-200 hover:border-t-blue-500"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {p.name}
                    </h4>
                    {prog >= 100 ? (
                      <CheckCircle2 className="text-emerald-500" size={20} />
                    ) : (
                      <div className="text-xs font-bold bg-slate-100 px-2 py-1 rounded text-slate-600">
                        {prog}%
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400 mb-4">
                    <MapPin size={12} /> {p.description || "Bangkok, Thailand"}
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full"
                      style={{ width: `${prog}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>
                      Deadline:{" "}
                      {p.timeline?.length
                        ? formatDate(p.timeline[p.timeline.length - 1].end)
                        : "TBD"}
                    </span>
                    <span>{p.tasks?.length || 0} tasks</span>
                  </div>
                </div>
              </Card>
            );
          })}
          {projects.length === 0 && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400">
              ยังไม่มีโครงการ
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- 5. Project Detail View ---

const ProjectDetailView = ({
  project,
  members,
  updateProject,
  setActiveProjectId,
  viewMode,
}) => {
  const [activeTab, setActiveTab] = useState("timeline");
  const [showTaskModal, setShowTaskModal] = useState(false);

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveProjectId(null)}
            className="p-2 bg-white border rounded-full hover:bg-slate-50 text-slate-500 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {project.name}
            </h2>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <Clock size={14} /> {formatDate(project.createdAt)}
              </span>
              {viewMode === "contractor" && (
                <Badge color="amber">Contractor View</Badge>
              )}
            </div>
          </div>
        </div>
        {activeTab === "kanban" && (
          <button
            onClick={() => setShowTaskModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm hover:bg-blue-700"
          >
            <Plus size={16} /> เพิ่มงาน
          </button>
        )}
      </div>
      <div className="bg-white p-1 rounded-xl border border-slate-200 inline-flex shadow-sm">
        <button
          onClick={() => setActiveTab("timeline")}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
            activeTab === "timeline"
              ? "bg-slate-800 text-white shadow"
              : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <Activity size={16} /> S-Curve & BOQ
        </button>
        <button
          onClick={() => setActiveTab("kanban")}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all",
            activeTab === "kanban"
              ? "bg-slate-800 text-white shadow"
              : "text-slate-500 hover:bg-slate-50"
          )}
        >
          <LayoutDashboard size={16} /> Kanban Board
        </button>
      </div>
      <div className="min-h-[500px]">
        {activeTab === "timeline" ? (
          <TimelineTable
            project={project}
            updateProject={updateProject}
            viewMode={viewMode}
          />
        ) : (
          <KanbanBoard
            project={project}
            members={members}
            updateProject={updateProject}
          />
        )}
      </div>
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-lg mb-4">
              เพิ่มงานย่อย (Daily Task)
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const newTask = {
                  id: generateId(),
                  title: fd.get("title"),
                  assignee: fd.get("assignee"),
                  columnId: project.columns[0].id,
                };
                updateProject(
                  project.id,
                  { tasks: [...project.tasks, newTask] },
                  `เพิ่มงานใหม่: ${newTask.title}`
                );
                setShowTaskModal(false);
              }}
              className="space-y-4"
            >
              <input
                name="title"
                placeholder="ชื่อรายการงาน..."
                required
                className="w-full border rounded p-2"
              />
              <select name="assignee" className="w-full border rounded p-2">
                <option value="">-- ผู้รับผิดชอบ --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-slate-500"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 6. Main App ---

const EnterpriseProjectManager = () => {
  const {
    projects,
    activities,
    members,
    online,
    viewMode,
    toggleViewMode,
    createProject,
    updateProject,
    addMember,
    updateMember,
    deleteMember,
  } = useContext(ProjectContext);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [view, setView] = useState("dashboard");
  const [modals, setModals] = useState({ project: false, member: false });
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId),
    [projects, activeProjectId]
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm px-4 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => {
            setActiveProjectId(null);
            setView("dashboard");
          }}
        >
          <div className="bg-slate-900 p-2 rounded-lg">
            <LayoutDashboard className="text-white" size={20} />
          </div>
          <h1 className="text-lg font-black tracking-tight text-slate-800">
            AHC <span className="text-blue-600">PROJECT</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-colors",
              online
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            )}
          >
            {online ? (
              <>
                <Wifi size={14} /> ONLINE
              </>
            ) : (
              <>
                <WifiOff size={14} /> OFFLINE
              </>
            )}
          </div>
          <button
            onClick={() => setView("members")}
            className="hidden md:flex items-center gap-2 text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors text-slate-600"
          >
            <Users size={14} /> Team
          </button>
          <button
            onClick={toggleViewMode}
            className="hidden md:flex items-center gap-2 text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-full hover:bg-slate-200 transition-colors text-slate-600"
          >
            {viewMode === "admin" ? (
              <ShieldCheck size={14} />
            ) : (
              <Lock size={14} />
            )}{" "}
            {viewMode === "admin" ? "Admin" : "Site"}
          </button>
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold border border-blue-200">
            A
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === "members" ? (
          <MembersView
            members={members}
            addMember={addMember}
            updateMember={updateMember}
            deleteMember={deleteMember}
            setModals={setModals}
          />
        ) : !activeProject ? (
          <DashboardView
            projects={projects}
            activities={activities}
            setActiveProjectId={setActiveProjectId}
            setModals={setModals}
          />
        ) : (
          <ProjectDetailView
            project={activeProject}
            members={members}
            updateProject={updateProject}
            setActiveProjectId={setActiveProjectId}
            viewMode={viewMode}
          />
        )}
      </main>

      {modals.project && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="font-bold text-xl mb-4 text-slate-800">
              เปิดโครงการใหม่
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                createProject({
                  name: fd.get("name"),
                  description: fd.get("desc"),
                  startDate: fd.get("date"),
                });
                setModals({ ...modals, project: false });
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">
                  ชื่อโครงการ
                </label>
                <input
                  name="name"
                  required
                  className="w-full border rounded-lg p-2.5 mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">
                  รายละเอียด
                </label>
                <input
                  name="desc"
                  className="w-full border rounded-lg p-2.5 mt-1 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase">
                  วันเริ่มสัญญา
                </label>
                <input
                  name="date"
                  type="date"
                  required
                  className="w-full border rounded-lg p-2.5 mt-1"
                  defaultValue={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setModals({ ...modals, project: false })}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg shadow-blue-200 hover:bg-blue-700"
                >
                  สร้างโครงการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {modals.member && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            {(() => {
              const editDataEl = document.getElementById("edit-member-data");
              const isEdit = !!editDataEl;
              const initialData = isEdit
                ? {
                    id: editDataEl.dataset.id,
                    name: editDataEl.dataset.name,
                    role: editDataEl.dataset.role,
                    email: editDataEl.dataset.email,
                  }
                : {};
              return (
                <>
                  <h3 className="font-bold text-xl mb-4 text-slate-800">
                    {isEdit ? "แก้ไขข้อมูลบุคลากร" : "เพิ่มบุคลากรใหม่"}
                  </h3>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.target);
                      const data = {
                        name: fd.get("name"),
                        role: fd.get("role"),
                        email: fd.get("email"),
                      };
                      if (isEdit) updateMember(initialData.id, data);
                      else addMember(data);
                      setModals({ ...modals, member: false });
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        ชื่อ-นามสกุล
                      </label>
                      <input
                        name="name"
                        defaultValue={initialData.name}
                        required
                        className="w-full border rounded-lg p-2.5 mt-1 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        ตำแหน่ง
                      </label>
                      <select
                        name="role"
                        defaultValue={initialData.role}
                        className="w-full border rounded-lg p-2.5 mt-1 outline-none bg-white"
                      >
                        <option value="Project Manager">Project Manager</option>
                        <option value="Site Engineer">Site Engineer</option>
                        <option value="Foreman">Foreman</option>
                        <option value="Contractor">Contractor</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">
                        ติดต่อ
                      </label>
                      <input
                        name="email"
                        defaultValue={initialData.email}
                        className="w-full border rounded-lg p-2.5 mt-1 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <button
                        type="button"
                        onClick={() => setModals({ ...modals, member: false })}
                        className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg"
                      >
                        ยกเลิก
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 bg-emerald-600 text-white rounded"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

const App = () => (
  <ProjectProvider>
    <EnterpriseProjectManager />
  </ProjectProvider>
);
export default App;
