"use client";

import { useEffect, useState } from "react";
import { api, type Member, type Invite } from "@/lib/api-client";
import { Button } from "@/components/admin/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/admin/ui/Card";
import { Badge } from "@/components/admin/ui/Badge";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/admin/ui/Table";
import { EmptyState } from "@/components/admin/ui/EmptyState";
import { Modal } from "@/components/admin/ui/Modal";
import { Input } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { UserCog, Plus, Trash2, Mail } from "lucide-react";
import { format } from "date-fns";

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

const roleVariants: Record<string, "warning" | "info" | "default"> = {
  owner: "warning",
  admin: "info",
  member: "default",
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    role: "member",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        api.getMembers(),
        api.getInvites(),
      ]);
      setMembers(membersRes.members);
      setInvites(invitesRes.invites);
    } catch (err) {
      console.error("Failed to load team data:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await api.createInvite(formData);
      setInviteModalOpen(false);
      setFormData({ email: "", role: "member" });
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send invite";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(memberId: string, role: string) {
    try {
      await api.updateMember(memberId, { role });
      loadData();
    } catch (err) {
      console.error("Failed to update member role:", err);
    }
  }

  async function handleRemoveMember(id: string) {
    if (!confirm("Are you sure you want to remove this team member?")) return;

    try {
      await api.removeMember(id);
      loadData();
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  }

  async function handleRevokeInvite(id: string) {
    if (!confirm("Are you sure you want to revoke this invite?")) return;

    try {
      await api.deleteInvite(id);
      loadData();
    } catch (err) {
      console.error("Failed to revoke invite:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-navy-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Team</h1>
        <Button onClick={() => setInviteModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      {/* Members */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-navy-800">
          <h2 className="text-lg font-medium text-white">Members</h2>
        </div>
        {members.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No team members"
            description="Invite team members to collaborate on managing your status page."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-navy-700 rounded-full flex items-center justify-center">
                        {member.user.image ? (
                          <img
                            src={member.user.image}
                            alt=""
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <span className="text-sm text-navy-300">
                            {member.user.name?.[0]?.toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {member.user.name}
                        </p>
                        <p className="text-xs text-navy-400">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {member.role === "owner" ? (
                      <Badge variant={roleVariants[member.role]}>
                        {member.role}
                      </Badge>
                    ) : (
                      <Select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.id, e.target.value)
                        }
                        options={roleOptions}
                        className="w-28"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {format(new Date(member.createdAt), "PP")}
                  </TableCell>
                  <TableCell>
                    {member.role !== "owner" && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-1 text-navy-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-navy-800">
            <h2 className="text-lg font-medium text-white">Pending Invites</h2>
          </div>
          <Table>
            <TableHeader>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-navy-400" />
                      <span className="text-white">{invite.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={roleVariants[invite.role]}>
                      {invite.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(invite.expiresAt), "PP")}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleRevokeInvite(invite.id)}
                      className="p-1 text-navy-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        title="Invite Team Member"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            placeholder="teammate@example.com"
            required
          />
          <Select
            label="Role"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            options={roleOptions}
          />
          <p className="text-xs text-navy-400">
            Admins can manage all resources. Members have read-only access.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setInviteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Send Invite
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
