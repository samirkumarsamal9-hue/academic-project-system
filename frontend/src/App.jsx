import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { 
  FolderPlus, 
  PlusCircle, 
  Send, 
  Bell, 
  LogOut, 
  LayoutDashboard, 
  FolderKanban, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  ExternalLink,
  UserCheck
} from 'lucide-react';

const API_BASE = 'http://localhost:4000/api/v1';

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [authMode, setAuthMode] = useState('login');
  
  // Auth Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Student',
    department: 'Computer Science'
  });

  // App Data State
  const [projects, setProjects] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [userList, setUserList] = useState([]);
  
  // New Project Form State
  const [newProject, setNewProject] = useState({ 
    title: '', 
    description: '', 
    studentId: '', 
    supervisorId: '' 
  });
  
  // Milestone Form States
  const [milestoneInputs, setMilestoneInputs] = useState({});
  const [submissionUrls, setSubmissionUrls] = useState({});

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }
  }, [token]);

  useEffect(() => {
    if (!token || !user) return;

    fetchProjects();
    if (user.role === 'Admin' || user.role === 'Supervisor') {
      fetchAnalytics();
    }
    if (user.role === 'Admin') {
      fetchUsers();
    }

    const socket = io('http://localhost:4000');
    socket.emit('join_room', user.id);

    socket.on('notification_receive', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
    });

    return () => socket.disconnect();
  }, [user, token]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (authMode === 'login') {
        const res = await axios.post(`${API_BASE}/auth/login`, {
          email: formData.email,
          password: formData.password
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setToken(res.data.token);
        setUser(res.data.user);
      } else {
        await axios.post(`${API_BASE}/auth/register`, formData);
        alert('Account registered! Please log in.');
        setAuthMode('login');
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setToken('');
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API_BASE}/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const projectsWithMilestones = await Promise.all(
        res.data.map(async (p) => {
          try {
            const mRes = await axios.get(`${API_BASE}/milestones?project=${p._id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            return { ...p, milestones: mRes.data || [] };
          } catch {
            return { ...p, milestones: [] };
          }
        })
      );
      setProjects(projectsWithMilestones);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get(`${API_BASE}/analytics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAnalytics(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        title: newProject.title,
        description: newProject.description,
        studentGroup: newProject.studentId ? [newProject.studentId] : [],
        supervisor: newProject.supervisorId || undefined
      };

      await axios.post(`${API_BASE}/projects`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewProject({ title: '', description: '', studentId: '', supervisorId: '' });
      fetchProjects();
      fetchAnalytics();
      alert('Project created and assigned successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create project');
    }
  };

  const addMilestone = async (projectId) => {
    const input = milestoneInputs[projectId];
    if (!input?.title || !input?.deadline) {
      return alert('Please enter milestone title and deadline date.');
    }

    try {
      await axios.post(
        `${API_BASE}/milestones`,
        {
          project: projectId,
          title: input.title,
          deadline: input.deadline
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMilestoneInputs({ ...milestoneInputs, [projectId]: { title: '', deadline: '' } });
      fetchProjects();
      alert('Milestone added successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add milestone');
    }
  };

  const submitMilestone = async (milestoneId) => {
    const fileUrl = submissionUrls[milestoneId];
    if (!fileUrl) return alert('Please enter a submission URL or file link.');
    try {
      await axios.put(
        `${API_BASE}/milestones/${milestoneId}/submit`,
        { fileUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchProjects();
      alert('Milestone submitted successfully!');
    } catch (err) {
      alert(err.response?.data?.message || 'Submission failed');
    }
  };

  const reviewMilestone = async (milestoneId, status) => {
    const feedback = prompt('Enter review feedback:');
    try {
      await axios.put(
        `${API_BASE}/milestones/${milestoneId}/review`,
        { status, feedback: feedback || 'Reviewed' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchProjects();
    } catch (err) {
      alert(err.response?.data?.message || 'Review failed');
    }
  };

  if (!user) {
    return (
      <div style={styles.authWrapper}>
        <div style={styles.authCard}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={styles.authLogoBadge}><FolderKanban size={28} color="#2563eb" /></div>
            <h2 style={styles.heading}>Academic Monitor Portal</h2>
            <p style={styles.subHeading}>{authMode === 'login' ? 'Sign in to monitor projects & deadlines' : 'Register your institutional account'}</p>
          </div>
          
          <form onSubmit={handleAuth} style={styles.form}>
            {authMode === 'register' && (
              <>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Full Name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <select
                  style={styles.input}
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="Student">Student</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Admin">Admin</option>
                </select>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="Department (e.g. CSE)"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </>
            )}
            <input
              style={styles.input}
              type="email"
              placeholder="Institutional Email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <input
              style={styles.input}
              type="password"
              placeholder="Password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button type="submit" style={styles.primaryBtn}>
              {authMode === 'login' ? 'Sign In to Workspace' : 'Create Account'}
            </button>
          </form>
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            style={styles.switchBtn}
          >
            {authMode === 'login' ? "Don't have an account? Register" : 'Already registered? Log in'}
          </button>
        </div>
      </div>
    );
  }

  const studentsList = userList.filter((u) => u.role === 'Student');
  const supervisorsList = userList.filter((u) => u.role === 'Supervisor');

  return (
    <div style={styles.layoutWrapper}>
      {/* Modern Left Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.brandBox}>
          <div style={styles.brandIcon}><FolderKanban size={22} color="#fff" /></div>
          <div>
            <h2 style={styles.brandTitle}>APMS Portal</h2>
            <span style={styles.brandSub}>Academic Monitoring</span>
          </div>
        </div>

        <nav style={styles.navMenu}>
          <div style={styles.navItemActive}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>
          <div style={styles.navItem}>
            <FolderKanban size={18} />
            <span>Projects & Milestones</span>
          </div>
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.userProfileTile}>
            <div style={styles.avatarLetter}>{user.name ? user.name[0].toUpperCase() : 'U'}</div>
            <div style={{ overflow: 'hidden' }}>
              <div style={styles.userNameText}>{user.name}</div>
              <div style={styles.userRoleTag}>{user.role}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.sidebarLogoutBtn}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div style={styles.mainContainer}>
        {/* Top Navbar */}
        <header style={styles.topNavbar}>
          <div>
            <h1 style={styles.pageTitle}>Project Overview & Tracking</h1>
            <p style={styles.pageSubtitle}>Monitor student capstone deliverables and milestone reviews</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={styles.bellButton}>
              <Bell size={18} color="#475569" />
              {notifications.length > 0 && <span style={styles.notifBadge}>{notifications.length}</span>}
            </div>
            <div style={styles.roleBadgeHeader}>
              <UserCheck size={14} /> {user.role} Portal
            </div>
          </div>
        </header>

        {/* Global Analytics Cards in Landscape */}
        {(user.role === 'Admin' || user.role === 'Supervisor') && analytics && (
          <section style={styles.statsGrid}>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Total Projects</span>
              <div style={styles.statValue}>{analytics.totalProjects}</div>
              <span style={styles.statFooter}>Assigned this term</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>In-Progress</span>
              <div style={{ ...styles.statValue, color: '#f59e0b' }}>{analytics.inProgressProjects}</div>
              <span style={styles.statFooter}>Awaiting final sign-off</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Completed</span>
              <div style={{ ...styles.statValue, color: '#10b981' }}>{analytics.completedProjects}</div>
              <span style={styles.statFooter}>Successfully validated</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Completion Rate</span>
              <div style={{ ...styles.statValue, color: '#2563eb' }}>{analytics.completionRate}%</div>
              <span style={styles.statFooter}>Class overall throughput</span>
            </div>
          </section>
        )}

        {/* Admin Project Creation Card */}
        {user.role === 'Admin' && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardHeaderTitle}>
                <FolderPlus size={18} color="#2563eb" />
                <span>Initialize & Assign Capstone Project</span>
              </div>
            </div>
            <form onSubmit={createProject} style={styles.projectFormGrid}>
              <input
                style={styles.input}
                placeholder="Project Title (e.g. Academic Monitoring System)"
                required
                value={newProject.title}
                onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
              />
              <input
                style={styles.input}
                placeholder="Brief Scope & Objectives"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px' }}>
                <select
                  style={styles.input}
                  value={newProject.studentId}
                  onChange={(e) => setNewProject({ ...newProject, studentId: e.target.value })}
                >
                  <option value="">-- Assign Student --</option>
                  {studentsList.map((s) => (
                    <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
                  ))}
                </select>

                <select
                  style={styles.input}
                  value={newProject.supervisorId}
                  onChange={(e) => setNewProject({ ...newProject, supervisorId: e.target.value })}
                >
                  <option value="">-- Assign Supervisor --</option>
                  {supervisorsList.map((sup) => (
                    <option key={sup._id} value={sup._id}>{sup.name} ({sup.email})</option>
                  ))}
                </select>

                <button type="submit" style={styles.primaryBtn}>Create & Assign</button>
              </div>
            </form>
          </div>
        )}

        {/* Projects Landscape Grid */}
        <main style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={styles.sectionHeading}>
              {user.role === 'Student' ? 'My Assigned Capstone' : 'Active Projects & Timeline'}
            </h2>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Showing {projects.length} project(s)</span>
          </div>

          {projects.length === 0 ? (
            <div style={styles.emptyState}>No projects currently assigned to this account.</div>
          ) : (
            <div style={styles.projectsLandscapeGrid}>
              {projects.map((proj) => (
                <div key={proj._id} style={styles.projectCardLandscape}>
                  {/* Card Header */}
                  <div style={styles.projectCardTop}>
                    <div>
                      <h3 style={styles.projectTitle}>{proj.title}</h3>
                      <p style={styles.projectDesc}>{proj.description || 'No description provided.'}</p>
                    </div>
                    <span style={proj.status === 'Completed' ? styles.statusTagCompleted : styles.statusTagActive}>
                      {proj.status}
                    </span>
                  </div>

                  {/* Members Information Badges */}
                  <div style={styles.membersStrip}>
                    <div style={styles.memberChip}>
                      <span style={styles.chipLabel}>Student:</span>
                      <strong>{proj.studentGroup?.map((s) => s.name).join(', ') || 'Unassigned'}</strong>
                    </div>
                    <div style={styles.memberChip}>
                      <span style={styles.chipLabel}>Supervisor:</span>
                      <strong>{proj.supervisor?.name || 'Unassigned'}</strong>
                    </div>
                  </div>

                  {/* Add Milestone Form for Admin & Supervisor */}
                  {(user.role === 'Admin' || user.role === 'Supervisor') && (
                    <div style={styles.addMilestoneBox}>
                      <span style={styles.milestoneBoxTitle}>
                        <PlusCircle size={14} color="#2563eb" /> Add Milestone / Deadline:
                      </span>
                      <div style={styles.milestoneInputRow}>
                        <input
                          style={{ ...styles.smallInput, flex: 2 }}
                          placeholder="e.g. SRS Submission, Design Architecture"
                          value={milestoneInputs[proj._id]?.title || ''}
                          onChange={(e) =>
                            setMilestoneInputs({
                              ...milestoneInputs,
                              [proj._id]: { ...milestoneInputs[proj._id], title: e.target.value }
                            })
                          }
                        />
                        <input
                          type="date"
                          style={{ ...styles.smallInput, flex: 1 }}
                          value={milestoneInputs[proj._id]?.deadline || ''}
                          onChange={(e) =>
                            setMilestoneInputs({
                              ...milestoneInputs,
                              [proj._id]: { ...milestoneInputs[proj._id], deadline: e.target.value }
                            })
                          }
                        />
                        <button onClick={() => addMilestone(proj._id)} style={styles.smallBtn}>
                          Add
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Milestones Listing */}
                  <div style={{ marginTop: '16px' }}>
                    <h4 style={styles.milestonesSubheading}>Assigned Milestones & Reviews</h4>
                    {proj.milestones && proj.milestones.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {proj.milestones.map((m) => (
                          <div key={m._id} style={styles.milestoneItem}>
                            <div style={{ flex: 1 }}>
                              <div style={styles.milestoneHeaderRow}>
                                <span style={styles.milestoneTitleText}>{m.title}</span>
                                <span style={m.status === 'Approved' ? styles.badgeApproved : styles.badgePending}>
                                  {m.status}
                                </span>
                              </div>
                              <div style={styles.milestoneMeta}>
                                <span>Due: {new Date(m.deadline).toLocaleDateString()}</span>
                                {m.uploadedFileUrl && (
                                  <a href={m.uploadedFileUrl} target="_blank" rel="noreferrer" style={styles.submissionLink}>
                                    <ExternalLink size={12} /> View Submission
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Student Action: Submission Link */}
                            {user.role === 'Student' && m.status !== 'Approved' && (
                              <div style={styles.studentSubmitGroup}>
                                <input
                                  style={styles.smallInput}
                                  placeholder="Submission URL (Drive / GitHub)"
                                  value={submissionUrls[m._id] || ''}
                                  onChange={(e) => setSubmissionUrls({ ...submissionUrls, [m._id]: e.target.value })}
                                />
                                <button onClick={() => submitMilestone(m._id)} style={styles.smallBtn}>
                                  <Send size={13} /> Submit
                                </button>
                              </div>
                            )}

                            {/* Supervisor / Admin Action: Approve / Revision */}
                            {(user.role === 'Supervisor' || user.role === 'Admin') && (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button onClick={() => reviewMilestone(m._id, 'Approved')} style={styles.approveBtn}>
                                  Approve
                                </button>
                                <button onClick={() => reviewMilestone(m._id, 'Needs Revision')} style={styles.rejectBtn}>
                                  Revision
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={styles.noMilestonesText}>No milestones added yet.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const styles = {
  // Layout Root
  layoutWrapper: { display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', color: '#fff', display: 'flex', flexDirection: 'column', padding: '24px 16px', flexShrink: 0 },
  brandBox: { display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '24px', borderBottom: '1px solid #1e293b' },
  brandIcon: { backgroundColor: '#2563eb', padding: '8px', borderRadius: '8px', display: 'flex' },
  brandTitle: { margin: 0, fontSize: '16px', fontWeight: 'bold', color: '#f8fafc' },
  brandSub: { fontSize: '11px', color: '#94a3b8' },
  navMenu: { marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  navItemActive: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#1e293b', color: '#38bdf8', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
  navItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '8px', color: '#94a3b8', fontSize: '14px', cursor: 'pointer' },
  sidebarFooter: { paddingTop: '16px', borderTop: '1px solid #1e293b', display: 'flex', flexDirection: 'column', gap: '12px' },
  userProfileTile: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px' },
  avatarLetter: { width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  userNameText: { fontSize: '13px', fontWeight: '600', color: '#f1f5f9', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  userRoleTag: { fontSize: '11px', color: '#38bdf8' },
  sidebarLogoutBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#1e293b', color: '#ef4444', border: '1px solid #334155', padding: '8px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' },

  // Main Container
  mainContainer: { flex: 1, padding: '32px 40px', overflowY: 'auto' },
  topNavbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' },
  pageTitle: { margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#0f172a' },
  pageSubtitle: { margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' },
  roleBadgeHeader: { display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#e0e7ff', color: '#3730a3', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  bellButton: { position: 'relative', padding: '8px', borderRadius: '50%', backgroundColor: '#fff', border: '1px solid #e2e8f0', cursor: 'pointer' },
  notifBadge: { position: 'absolute', top: -3, right: -3, backgroundColor: '#ef4444', color: '#fff', fontSize: '10px', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // Analytics Grid
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '28px' },
  statCard: { backgroundColor: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  statLabel: { fontSize: '13px', color: '#64748b', fontWeight: '500' },
  statValue: { fontSize: '28px', fontWeight: 'bold', margin: '8px 0 4px 0', color: '#0f172a' },
  statFooter: { fontSize: '12px', color: '#94a3b8' },

  // Cards & Forms
  card: { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: '28px' },
  cardHeader: { marginBottom: '16px' },
  cardHeaderTitle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '600', color: '#0f172a' },
  projectFormGrid: { display: 'flex', flexDirection: 'column', gap: '14px' },
  input: { padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' },
  primaryBtn: { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },

  // Projects Grid
  sectionHeading: { margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#0f172a' },
  projectsLandscapeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: '24px' },
  projectCardLandscape: { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' },
  projectCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  projectTitle: { margin: 0, fontSize: '17px', fontWeight: 'bold', color: '#0f172a' },
  projectDesc: { margin: '6px 0 0 0', fontSize: '13px', color: '#64748b' },
  statusTagActive: { backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  statusTagCompleted: { backgroundColor: '#dcfce7', color: '#15803d', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' },
  membersStrip: { display: 'flex', gap: '12px', marginTop: '14px', padding: '10px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' },
  memberChip: { fontSize: '12px', color: '#334155' },
  chipLabel: { color: '#64748b', marginRight: '4px' },

  // Milestones Subsection
  addMilestoneBox: { backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', marginTop: '14px', border: '1px solid #e2e8f0' },
  milestoneBoxTitle: { fontSize: '12px', fontWeight: '600', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' },
  milestoneInputRow: { display: 'flex', gap: '8px', marginTop: '8px' },
  milestonesSubheading: { margin: '0 0 10px 0', fontSize: '13px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' },
  milestoneItem: { backgroundColor: '#f8fafc', borderRadius: '8px', padding: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' },
  milestoneHeaderRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  milestoneTitleText: { fontSize: '14px', fontWeight: '600', color: '#0f172a' },
  milestoneMeta: { fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px' },
  submissionLink: { display: 'flex', alignItems: 'center', gap: '4px', color: '#2563eb', textDecoration: 'none', fontWeight: '500' },
  badgeApproved: { backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  badgePending: { backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  studentSubmitGroup: { display: 'flex', gap: '6px' },
  smallInput: { padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' },
  smallBtn: { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' },
  approveBtn: { backgroundColor: '#dcfce7', color: '#166534', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  rejectBtn: { backgroundColor: '#fee2e2', color: '#991b1b', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  noMilestonesText: { fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', margin: 0 },
  emptyState: { padding: '40px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8' },

  // Auth Card
  authWrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  authCard: { backgroundColor: '#fff', padding: '36px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', width: '100%', maxWidth: '420px', border: '1px solid #e2e8f0' },
  authLogoBadge: { width: '48px', height: '48px', borderRadius: '12px', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto' },
  heading: { margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#0f172a' },
  subHeading: { margin: '6px 0 0 0', fontSize: '13px', color: '#64748b' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  switchBtn: { marginTop: '16px', background: 'none', border: 'none', color: '#2563eb', fontSize: '13px', cursor: 'pointer', fontWeight: '500', width: '100%', textAlign: 'center' }
};