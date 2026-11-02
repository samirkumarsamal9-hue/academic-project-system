import AccountModal from './AccountModal';
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

const API_BASE = 'https://academic-project-system.onrender.com/api/v1';

export default function App() {
  const [showAccountModal, setShowAccountModal] = useState(false);
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

    const socket = io('https://academic-project-system.onrender.com/');
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
const handleReviewMilestone = (projectId, milestoneId, status) => {
    reviewMilestone(milestoneId, status);
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
         <button 
  onClick={() => setShowAccountModal(true)} 
  style={{
    ...styles.sidebarLogoutBtn,
    marginBottom: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#e2e8f0',
    borderRadius: '8px',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    width: '100%',
    fontSize: '13px',
    fontWeight: '500'
  }}
>
  ⚙️ Account Settings
</button>
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
            {/* Card 1: Total Projects */}
            <div style={styles.statCard}>
              <div style={{ ...styles.statIconWrap, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                <FolderPlus size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.statLabel}>Total Projects</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={styles.statValue}>{analytics?.totalProjects ?? projects.length}</span>
                  <span style={{ ...styles.statBadge, background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>Active</span>
                </div>
              </div>
            </div>

            {/* Card 2: In-Progress */}
            <div style={styles.statCard}>
              <div style={{ ...styles.statIconWrap, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                <Clock size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.statLabel}>In-Progress</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={styles.statValue}>{analytics?.inProgressProjects ?? projects.filter(p => p.status !== 'Completed').length}</span>
                  <span style={{ ...styles.statBadge, background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>Pending</span>
                </div>
              </div>
            </div>

            {/* Card 3: Completed */}
            <div style={styles.statCard}>
              <div style={{ ...styles.statIconWrap, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <CheckCircle2 size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.statLabel}>Completed</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={styles.statValue}>{analytics?.completedProjects ?? projects.filter(p => p.status === 'Completed').length}</span>
                  <span style={{ ...styles.statBadge, background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>Finished</span>
                </div>
              </div>
            </div>

            {/* Card 4: Completion Rate */}
            <div style={styles.statCard}>
              <div style={{ ...styles.statIconWrap, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                <UserCheck size={22} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.statLabel}>Completion Rate</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={styles.statValue}>
                    {analytics?.completionRate ?? (projects.length > 0 ? Math.round((projects.filter(p => p.status === 'Completed').length / projects.length) * 100) : 0)}%
                  </span>
                  <span style={{ ...styles.statBadge, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>Overall</span>
                </div>
              </div>
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
        <main style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                {user.role === 'Student' ? 'My Assigned Capstone' : 'Active Projects & Timeline'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                Monitor deliverables, assigned students, and milestone progress
              </p>
            </div>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#334155', backgroundColor: '#e2e8f0', padding: '4px 12px', borderRadius: '16px' }}>
              Showing {projects?.length || 0} project(s)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: '20px', marginTop: '16px' }}>
            {projects && projects.length > 0 ? (
              projects.map((p) => (
                <div 
                  key={p._id} 
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '24px',
                    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}
                >
                  {/* Project Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>{p.title}</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#475569' }}>
                        {p.description || 'Milestone tracking and review management system.'}
                      </p>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '4px 10px',
                      borderRadius: '20px',
                      backgroundColor: p.status === 'Completed' ? '#dcfce7' : '#fef3c7',
                      color: p.status === 'Completed' ? '#166534' : '#92400e',
                      whiteSpace: 'nowrap'
                    }}>
                      {p.status || 'In-Progress'}
                    </span>
                  </div>

                  {/* Student & Supervisor Badge Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '12px' }}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Student</span>
                      <strong style={{ color: '#0f172a' }}>{p.studentName || 'Unassigned'}</strong>
                    </div>
                    <div style={{ fontSize: '12px' }}>
                      <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: '600' }}>Supervisor</span>
                      <strong style={{ color: '#0f172a' }}>{p.supervisorName || 'Unassigned'}</strong>
                    </div>
                  </div>

                  {/* Add Milestone Inline Bar */}
                  <div style={{ padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '8px' }}>
                      + Add Milestone / Deadline:
                    </span>
                    <form onSubmit={(e) => handleAddMilestone(e, p._id)} style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="e.g. SRS Submission, Design Architecture" 
                        value={milestoneInputs[p._id]?.title || ''} 
                        onChange={(e) => handleMilestoneChange(p._id, 'title', e.target.value)}
                        style={{ flex: 2, padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none' }}
                      />
                      <input 
                        type="date" 
                        value={milestoneInputs[p._id]?.deadline || ''} 
                        onChange={(e) => handleMilestoneChange(p._id, 'deadline', e.target.value)}
                        style={{ flex: 1, padding: '8px 10px', fontSize: '13px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#0f172a', outline: 'none' }}
                      />
                      <button type="submit" style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                        Add
                      </button>
                    </form>
                  </div>

                  {/* Milestones & Review List */}
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
                      Assigned Milestones & Reviews
                    </span>
                    {p.milestones && p.milestones.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {p.milestones.map((m, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>{m.title}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Due: {new Date(m.deadline).toLocaleDateString()}</div>
                            </div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  {m.status === 'Approved' ? (
    <span style={{ 
      backgroundColor: '#dcfce7', 
      color: '#166534', 
      padding: '4px 10px', 
      borderRadius: '20px', 
      fontSize: '11px', 
      fontWeight: '700',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px'
    }}>
      ✓ Approved
    </span>
  ) : m.status === 'Revision' ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ 
        backgroundColor: '#fee2e2', 
        color: '#991b1b', 
        padding: '4px 8px', 
        borderRadius: '20px', 
        fontSize: '11px', 
        fontWeight: '700' 
      }}>
        Revision Required
      </span>
      {user?.role !== 'Student' && (
        <button 
          type="button" 
          onClick={() => handleReviewMilestone(p._id, m._id, 'Approved')} 
          style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
        >
          Approve
        </button>
      )}
    </div>
  ) : (
    /* Pending Review: Sirf Supervisor/Admin ko review buttons dikhenge */
    user?.role !== 'Student' ? (
      <div style={{ display: 'flex', gap: '6px' }}>
        <button 
          type="button" 
          onClick={() => handleReviewMilestone(p._id, m._id, 'Approved')} 
          style={{ backgroundColor: '#10b981', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
        >
          Approve
        </button>
        <button 
          type="button" 
          onClick={() => handleReviewMilestone(p._id, m._id, 'Revision')} 
          style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
        >
          Revision
        </button>
      </div>
    ) : (
      <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
        Pending Review
      </span>
    )
  )}
</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>No milestones added yet.</div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: '#64748b', fontSize: '14px' }}>No projects available.</div>
            )}
          </div>
        </main>
     {showAccountModal && (
        <AccountModal 
          user={user} 
          token={token} 
          API_BASE={API_BASE} 
          onClose={() => setShowAccountModal(false)}
          onUserUpdated={(updated) => setUser(updated)}
        />
    )}
    </div>
  </div>
  );
}
const styles = {
  // Layout Root - Clean SaaS White Theme with College BG
  layoutWrapper: { 
    display: 'flex', 
    minHeight: '100vh', 
    backgroundColor: '#f1f5f9',
    backgroundImage: 'linear-gradient(rgba(241, 245, 249, 0.86), rgba(241, 245, 249, 0.90)), url("/Mitm.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  },

  // Sidebar - Crisp Dark Slate
  sidebar: { 
    width: '260px', 
    backgroundColor: '#0f172a', 
    color: '#ffffff', 
    display: 'flex', 
    flexDirection: 'column', 
    boxShadow: '4px 0 24px rgba(0, 0, 0, 0.08)',
    zIndex: 10,
    flexShrink: 0
  },
  brandBox: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    padding: '24px 20px', 
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)' 
  },
  brandIcon: { 
    backgroundColor: '#2563eb', 
    padding: '8px', 
    borderRadius: '10px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    flexShrink: 0
  },
  brandTitle: { margin: 0, fontSize: '16px', fontWeight: '700', color: '#f8fafc' },
  brandSub: { fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '2px' },
  navMenu: { 
    marginTop: '20px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '6px', 
    flex: 1, 
    padding: '0 14px' 
  },
  navItemActive: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    padding: '10px 14px', 
    borderRadius: '10px', 
    backgroundColor: '#2563eb', 
    color: '#ffffff', 
    fontWeight: '600', 
    fontSize: '14px', 
    cursor: 'pointer' 
  },
  navItem: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    padding: '10px 14px', 
    borderRadius: '10px', 
    color: '#94a3b8', 
    fontWeight: '500', 
    fontSize: '14px', 
    cursor: 'pointer' 
  },
  sidebarFooter: { 
    padding: '16px', 
    borderTop: '1px solid rgba(255, 255, 255, 0.08)', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '12px' 
  },
  userProfileTile: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px' 
  },
  avatarLetter: { 
    width: '38px', 
    height: '38px', 
    borderRadius: '50%', 
    backgroundColor: '#2563eb', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontWeight: '700', 
    color: '#ffffff',
    flexShrink: 0 
  },
  userNameText: { fontSize: '13px', fontWeight: '600', color: '#f1f5f9', whiteSpace: 'nowrap' },
  userRoleTag: { fontSize: '11px', color: '#38bdf8', display: 'block' },
  sidebarLogoutBtn: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: '8px', 
    padding: '9px 12px', 
    borderRadius: '8px', 
    border: '1px solid rgba(255, 255, 255, 0.12)', 
    background: 'transparent', 
    color: '#f8fafc', 
    cursor: 'pointer', 
    fontSize: '13px', 
    fontWeight: '500', 
    width: '100%' 
  },

  // Main Container & Navbar
  mainContainer: { 
    flex: 1, 
    padding: '32px 40px', 
    overflowY: 'auto', 
    minHeight: '100vh',
    backgroundColor: 'transparent'
  },
  topNavbar: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: '28px',
    gap: '16px' 
  },
  pageTitle: { margin: 0, fontSize: '24px', fontWeight: '800', color: '#0f172a' },
  pageSubtitle: { margin: '4px 0 0', fontSize: '13px', color: '#475569' },
  roleBadgeHeader: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '6px', 
    backgroundColor: '#ffffff', 
    padding: '8px 16px', 
    borderRadius: '24px', 
    border: '1px solid #e2e8f0', 
    color: '#0f172a', 
    fontSize: '13px', 
    fontWeight: '600', 
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)' 
  },
  bellButton: { 
    position: 'relative', 
    padding: '8px', 
    borderRadius: '50%', 
    backgroundColor: '#ffffff', 
    border: '1px solid #e2e8f0', 
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  notifBadge: { 
    position: 'absolute', 
    top: -2, 
    right: -2, 
    backgroundColor: '#ef4444', 
    color: '#ffffff', 
    borderRadius: '50%', 
    width: '18px', 
    height: '18px', 
    fontSize: '10px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    fontWeight: '700' 
  },

  // Metric Cards
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  statCard: { 
    backgroundColor: '#ffffff', 
    padding: '18px 20px', 
    borderRadius: '16px', 
    border: '1px solid #e2e8f0', 
    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '16px' 
  },
  statIconWrap: { 
    width: '46px', 
    height: '46px', 
    borderRadius: '12px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    flexShrink: 0
  },
  statLabel: { fontSize: '13px', color: '#64748b', fontWeight: '500', marginBottom: '4px' },
  statValue: { fontSize: '26px', fontWeight: '700', color: '#0f172a', margin: 0 },
  statBadge: { 
    fontSize: '11px', 
    fontWeight: '600', 
    padding: '2px 8px', 
    borderRadius: '20px', 
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: '2px' 
  },

  // Forms & Containers
  card: { 
    backgroundColor: '#ffffff', 
    borderRadius: '16px', 
    border: '1px solid #e2e8f0', 
    padding: '24px', 
    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)', 
    marginBottom: '24px' 
  },
  cardHeader: { marginBottom: '16px' },
  cardHeaderTitle: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '700', color: '#0f172a' },
  projectFormGrid: { display: 'flex', flexDirection: 'column', gap: '14px' },
  input: { 
    padding: '12px 16px', 
    borderRadius: '10px', 
    border: '1px solid #cbd5e1', 
    fontSize: '14px', 
    backgroundColor: '#f8fafc', 
    color: '#0f172a', 
    outline: 'none', 
    boxSizing: 'border-box' 
  },
  primaryBtn: { 
    backgroundColor: '#2563eb', 
    color: '#ffffff', 
    border: 'none', 
    padding: '12px 22px', 
    borderRadius: '10px', 
    cursor: 'pointer', 
    fontWeight: '600', 
    fontSize: '14px' 
  },

  // Projects Grid & Landscape Cards
  sectionHeading: { margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' },
  projectsLandscapeGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: '20px', marginTop: '16px' },
  projectCardLandscape: { 
    backgroundColor: '#ffffff', 
    borderRadius: '16px', 
    border: '1px solid #e2e8f0', 
    padding: '22px', 
    boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)',
    color: '#0f172a'
  }
};