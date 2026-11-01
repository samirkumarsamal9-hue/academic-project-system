require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const app = express();
const server = http.createServer(app);

// Socket.IO Setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());

// Database Connection
const MONGO_URI = process.env.MONGO_URl;
mongoose.connect(MONGO_URI)
  .then(() => console.log('Connected to MongoDB Database Successfully!'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Schemas & Models
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['Admin', 'Supervisor', 'Student'], required: true },
  department: { type: String }
}, { timestamps: true });

const ProjectSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  studentGroup: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['In-Progress', 'Completed', 'Overdue'], default: 'In-Progress' },
  overallProgress: { type: Number, default: 0 }
}, { timestamps: true });

const MilestoneSchema = new mongoose.Schema({
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  title: { type: String, required: true },
  deadline: { type: Date, required: true },
  status: { type: String, enum: ['Pending', 'Submitted', 'Under Review', 'Needs Revision', 'Approved'], default: 'Pending' },
  uploadedFileUrl: { type: String, default: null },
  feedback: { type: String, default: '' },
  orderIndex: { type: Number, default: 1 }
}, { timestamps: true });

const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: true });

const ActivityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  details: { type: String },
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Project = mongoose.model('Project', ProjectSchema);
const Milestone = mongoose.model('Milestone', MilestoneSchema);
const Notification = mongoose.model('Notification', NotificationSchema);
const ActivityLog = mongoose.model('ActivityLog', ActivityLogSchema);

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Access Token Required' });

  jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey', (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or Expired Token' });
    req.user = user;
    next();
  });
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access Forbidden: Insufficient Permissions' });
    }
    next();
  };
};

const sendAlert = async (recipientId, title, message) => {
  const note = await Notification.create({ recipient: recipientId, title, message });
  io.to(recipientId.toString()).emit('notification_receive', note);
  return note;
};

io.on('connection', (socket) => {
  socket.on('join_room', (userId) => {
    socket.join(userId);
  });
});

// APIs
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword, role, department });
    res.status(201).json({ message: 'User registered successfully', userId: user._id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET || 'mysecretkey',
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
    res.json({ token, user: { id: user._id, name: user.name, role: user.role, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/v1/users', authenticateToken, async (req, res) => {
  try {
    const users = await User.find({}, 'name email role department');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/projects', authenticateToken, authorizeRoles('Admin'), async (req, res) => {
  try {
    const project = await Project.create(req.body);
    await ActivityLog.create({ user: req.user.id, action: 'PROJECT_CREATED', details: `Created ${project.title}` });
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/projects', authenticateToken, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'Student') filter = { studentGroup: req.user.id };
    if (req.user.role === 'Supervisor') filter = { supervisor: req.user.id };
    const projects = await Project.find(filter).populate('studentGroup', 'name email').populate('supervisor', 'name email');
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/milestones', authenticateToken, authorizeRoles('Admin', 'Supervisor'), async (req, res) => {
  try {
    const milestone = await Milestone.create(req.body);
    res.status(201).json(milestone);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/v1/milestones', authenticateToken, async (req, res) => {
  try {
    const filter = req.query.project ? { project: req.query.project } : {};
    const milestones = await Milestone.find(filter).sort({ deadline: 1 });
    res.json(milestones);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/v1/milestones/:id/submit', authenticateToken, authorizeRoles('Student'), async (req, res) => {
  try {
    const { fileUrl } = req.body;
    const milestone = await Milestone.findByIdAndUpdate(
      req.params.id,
      { uploadedFileUrl: fileUrl, status: 'Under Review' },
      { new: true }
    ).populate('project');

    if (milestone.project.supervisor) {
      await sendAlert(
        milestone.project.supervisor,
        'New Submission for Review',
        `Student uploaded submission for milestone: ${milestone.title}`
      );
    }
    res.json(milestone);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/v1/milestones/:id/review', authenticateToken, authorizeRoles('Supervisor', 'Admin'), async (req, res) => {
  try {
    const { status, feedback } = req.body;
    const milestone = await Milestone.findByIdAndUpdate(
      req.params.id,
      { status, feedback },
      { new: true }
    ).populate('project');

    const project = await Project.findById(milestone.project._id);
    for (const studentId of project.studentGroup) {
      await sendAlert(
        studentId,
        `Milestone ${status}`,
        `Milestone "${milestone.title}" status: ${status}. Feedback: ${feedback}`
      );
    }
    res.json(milestone);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/v1/analytics', authenticateToken, authorizeRoles('Admin', 'Supervisor'), async (req, res) => {
  try {
    const totalProjects = await Project.countDocuments();
    const completedProjects = await Project.countDocuments({ status: 'Completed' });
    const inProgressProjects = await Project.countDocuments({ status: 'In-Progress' });
    const overdueProjects = await Project.countDocuments({ status: 'Overdue' });

    res.json({
      totalProjects,
      completedProjects,
      inProgressProjects,
      overdueProjects,
      completionRate: totalProjects ? Math.round((completedProjects / totalProjects) * 100) : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});