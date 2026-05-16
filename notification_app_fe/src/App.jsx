import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Toolbar,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import { useEffect, useMemo, useState } from "react";
import { getPriorityNotifications, logFrontend } from "./api.js";

const TYPES = ["All", "Placement", "Result", "Event"];
const LIMITS = [10, 15, 20];

function getInitialLimit() {
  const requestedLimit = Number(new URLSearchParams(window.location.search).get("limit"));
  return LIMITS.includes(requestedLimit) ? requestedLimit : 10;
}

function getInitialType() {
  const requestedType = new URLSearchParams(window.location.search).get("type");
  return TYPES.includes(requestedType) ? requestedType : "All";
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function typeColor(type) {
  if (type === "Placement") {
    return "secondary";
  }
  if (type === "Result") {
    return "primary";
  }
  return "default";
}

function NotificationCard({ notification }) {
  return (
    <Paper className="notification-card" elevation={0}>
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
          <Chip
            size="small"
            label={notification.Type}
            color={typeColor(notification.Type)}
            variant={notification.Type === "Event" ? "outlined" : "filled"}
          />
          <Stack direction="row" alignItems="center" spacing={0.5} className="score">
            <PriorityHighIcon fontSize="small" />
            <Typography variant="body2">{Math.round(notification.priorityScore)}</Typography>
          </Stack>
        </Stack>
        <Typography variant="h6">{notification.Message}</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatTimestamp(notification.Timestamp)}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function App() {
  const [limit, setLimit] = useState(getInitialLimit);
  const [type, setType] = useState(getInitialType);
  const [notifications, setNotifications] = useState([]);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const unreadCount = notifications.length;
  const topType = useMemo(() => {
    return notifications[0]?.Type || "None";
  }, [notifications]);

  async function loadNotifications() {
    setLoading(true);
    setError("");
    try {
      const data = await getPriorityNotifications({ limit, type });
      setNotifications(data.notifications || []);
      setSource(data.source || "backend");
      await logFrontend("info", "page", `rendered ${data.count || 0} notifications`);
    } catch (loadError) {
      setError(loadError.message);
      await logFrontend("error", "page", loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [limit, type]);

  return (
    <Box className="app-shell">
      <AppBar position="sticky" color="inherit" elevation={0} className="topbar">
        <Toolbar>
          <Stack direction="row" alignItems="center" spacing={1.5} className="brand">
            <NotificationsActiveIcon color="primary" />
            <Typography variant="h6">Notification Center</Typography>
          </Stack>
          <Button startIcon={<RefreshIcon />} variant="contained" onClick={loadNotifications}>
            Refresh
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" className="content">
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4">Priority Inbox</Typography>
            <Typography color="text.secondary" className="subtitle">
              Important unread updates ranked by type weight and recency.
            </Typography>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Paper className="metric" elevation={0}>
                <Typography variant="body2" color="text.secondary">
                  Displaying
                </Typography>
                <Typography variant="h4">{unreadCount}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper className="metric" elevation={0}>
                <Typography variant="body2" color="text.secondary">
                  Top priority type
                </Typography>
                <Typography variant="h4">{topType}</Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper className="metric" elevation={0}>
                <Typography variant="body2" color="text.secondary">
                  Data source
                </Typography>
                <Typography variant="h4">{source || "Loading"}</Typography>
              </Paper>
            </Grid>
          </Grid>

          <Paper className="controls" elevation={0}>
            <FormControl size="small">
              <InputLabel id="limit-label">Limit</InputLabel>
              <Select
                labelId="limit-label"
                label="Limit"
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
              >
                {LIMITS.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small">
              <InputLabel id="type-label">Type</InputLabel>
              <Select
                labelId="type-label"
                label="Type"
                value={type}
                onChange={(event) => setType(event.target.value)}
              >
                {TYPES.map((item) => (
                  <MenuItem key={item} value={item}>
                    {item}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>

          {error && <Alert severity="error">{error}</Alert>}

          {loading ? (
            <Box className="loading">
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {notifications.map((notification) => (
                <Grid item xs={12} md={6} key={notification.ID}>
                  <NotificationCard notification={notification} />
                </Grid>
              ))}
            </Grid>
          )}

          {!loading && notifications.length === 0 && (
            <Paper className="empty-state" elevation={0}>
              <MarkEmailReadIcon color="secondary" />
              <Typography variant="h6">No notifications found</Typography>
            </Paper>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
