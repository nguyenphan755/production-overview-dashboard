import { useEffect, useMemo, useState } from "react";
import {
  createUser,
  listUsers,
  resetUserPassword,
  updateUser,
  type AuthUser,
  type ManagedUser,
} from "../services/authApi";

type AccountManagementProps = {
  token: string;
};

const roleOptions: AuthUser["role"][] = ["operator", "engineer", "supervisor", "admin"];

export default function AccountManagement({ token }: AccountManagementProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [createForm, setCreateForm] = useState({
    username: "",
    password: "",
    role: "operator" as AuthUser["role"],
    isActive: true,
    plant: "",
    area: "",
    line: "",
  });

  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState({
    username: "",
    role: "operator" as AuthUser["role"],
    isActive: true,
    plant: "",
    area: "",
    line: "",
    newPassword: "",
  });

  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => a.username.localeCompare(b.username));
  }, [users]);

  const loadUsers = async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await listUsers(token);
      setUsers(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    try {
      const newUser = await createUser(token, {
        username: createForm.username.trim(),
        password: createForm.password,
        role: createForm.role,
        isActive: createForm.isActive,
        plant: createForm.plant || undefined,
        area: createForm.area || undefined,
        line: createForm.line || undefined,
      });
      setUsers((prev) => [...prev, newUser]);
      setCreateForm({
        username: "",
        password: "",
        role: "operator",
        isActive: true,
        plant: "",
        area: "",
        line: "",
      });
      setMessage("User created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create user");
    }
  };

  const startEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      plant: user.plant || "",
      area: user.area || "",
      line: user.line || "",
      newPassword: "",
    });
  };

  const handleUpdateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) {
      return;
    }
    setMessage("");
    try {
      const updated = await updateUser(token, editingUser.id, {
        username: editForm.username.trim(),
        role: editForm.role,
        isActive: editForm.isActive,
        plant: editForm.plant || null,
        area: editForm.area || null,
        line: editForm.line || null,
      });
      setUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
      setEditingUser(updated);
      setMessage("User updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update user");
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser || !editForm.newPassword) {
      setMessage("Enter a new password before resetting.");
      return;
    }
    setMessage("");
    try {
      await resetUserPassword(token, editingUser.id, editForm.newPassword);
      setEditForm((prev) => ({ ...prev, newPassword: "" }));
      setMessage("Password reset.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to reset password");
    }
  };

  const handleToggleActive = async (user: ManagedUser) => {
    setMessage("");
    try {
      const updated = await updateUser(token, user.id, { isActive: !user.isActive });
      setUsers((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      if (editingUser?.id === updated.id) {
        startEdit(updated);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold">Account Management</h2>
          <p className="text-sm text-white/60">Create, update, and manage MES user accounts.</p>
        </div>
        <button
          type="button"
          className="px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 hover:bg-white/20"
          onClick={loadUsers}
        >
          Refresh
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm">
          {message}
        </div>
      )}

      <form className="grid gap-3 border border-white/10 rounded-xl p-4 mb-6" onSubmit={handleCreateUser}>
        <h3 className="text-sm uppercase tracking-wide text-white/60">Create User</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
            placeholder="Username / Email"
            value={createForm.username}
            onChange={(event) => setCreateForm({ ...createForm, username: event.target.value })}
            required
          />
          <input
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
            placeholder="Temporary password"
            type="password"
            value={createForm.password}
            onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
            required
          />
          <select
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
            value={createForm.role}
            onChange={(event) =>
              setCreateForm({ ...createForm, role: event.target.value as AuthUser["role"] })
            }
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
            placeholder="Plant (optional)"
            value={createForm.plant}
            onChange={(event) => setCreateForm({ ...createForm, plant: event.target.value })}
          />
          <input
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
            placeholder="Area (optional)"
            value={createForm.area}
            onChange={(event) => setCreateForm({ ...createForm, area: event.target.value })}
          />
          <input
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
            placeholder="Line (optional)"
            value={createForm.line}
            onChange={(event) => setCreateForm({ ...createForm, line: event.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={createForm.isActive}
            onChange={(event) => setCreateForm({ ...createForm, isActive: event.target.checked })}
          />
          Active
        </label>
        <button
          type="submit"
          className="justify-self-start px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm font-medium"
        >
          Create User
        </button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="grid grid-cols-6 gap-2 px-4 py-2 text-xs uppercase text-white/50 bg-white/5">
            <span className="col-span-2">Username</span>
            <span>Role</span>
            <span>Status</span>
            <span>Last login</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-white/10">
            {loading && <div className="px-4 py-3 text-sm">Loading users...</div>}
            {!loading &&
              sortedUsers.map((user) => (
                <div key={user.id} className="grid grid-cols-6 gap-2 px-4 py-3 text-sm">
                  <span className="col-span-2">{user.username}</span>
                  <span>{user.role}</span>
                  <span>{user.isActive ? "Active" : "Disabled"}</span>
                  <span className="text-white/60">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "—"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
                      onClick={() => startEdit(user)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded-md bg-white/10 hover:bg-white/20"
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              ))}
            {!loading && sortedUsers.length === 0 && (
              <div className="px-4 py-3 text-sm text-white/60">No users found.</div>
            )}
          </div>
        </div>

        <div className="border border-white/10 rounded-xl p-4">
          <h3 className="text-sm uppercase tracking-wide text-white/60 mb-3">Edit User</h3>
          {editingUser ? (
            <form className="grid gap-3" onSubmit={handleUpdateUser}>
              <input
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                value={editForm.username}
                onChange={(event) => setEditForm({ ...editForm, username: event.target.value })}
              />
              <select
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                value={editForm.role}
                onChange={(event) =>
                  setEditForm({ ...editForm, role: event.target.value as AuthUser["role"] })
                }
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) =>
                    setEditForm({ ...editForm, isActive: event.target.checked })
                  }
                />
                Active
              </label>
              <input
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                placeholder="Plant (optional)"
                value={editForm.plant}
                onChange={(event) => setEditForm({ ...editForm, plant: event.target.value })}
              />
              <input
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                placeholder="Area (optional)"
                value={editForm.area}
                onChange={(event) => setEditForm({ ...editForm, area: event.target.value })}
              />
              <input
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                placeholder="Line (optional)"
                value={editForm.line}
                onChange={(event) => setEditForm({ ...editForm, line: event.target.value })}
              />
              <button
                type="submit"
                className="justify-self-start px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm font-medium"
              >
                Save Changes
              </button>
              <div className="border-t border-white/10 pt-3">
                <label className="text-xs text-white/60 uppercase">Reset Password</label>
                <div className="flex gap-2 mt-2">
                  <input
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm"
                    placeholder="New password"
                    type="password"
                    value={editForm.newPassword}
                    onChange={(event) =>
                      setEditForm({ ...editForm, newPassword: event.target.value })
                    }
                  />
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm"
                    onClick={handleResetPassword}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="text-sm text-white/60">Select a user to edit.</div>
          )}
        </div>
      </div>
    </div>
  );
}
