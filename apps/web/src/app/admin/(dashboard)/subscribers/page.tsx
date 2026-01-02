"use client";

import { useEffect, useState } from "react";
import { api, type Subscriber } from "@/lib/api-client";
import { Card } from "@/components/admin/ui/Card";
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
import { Users, Trash2 } from "lucide-react";
import { format } from "date-fns";

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadSubscribers();
  }, []);

  async function loadSubscribers() {
    try {
      const data = await api.getSubscribers("limit=100");
      setSubscribers(data.subscribers);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error("Failed to load subscribers:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this subscriber?")) return;

    try {
      await api.deleteSubscriber(id);
      loadSubscribers();
    } catch (err) {
      console.error("Failed to delete subscriber:", err);
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
        <div>
          <h1 className="text-2xl font-semibold text-white">Subscribers</h1>
          <p className="text-navy-400 text-sm mt-1">
            {total} total subscriber{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <Card className="p-0 overflow-hidden">
        {subscribers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No subscribers yet"
            description="Subscribers will receive email notifications about incidents and maintenance."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subscribed</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableHeader>
            <TableBody>
              {subscribers.map((subscriber) => (
                <TableRow key={subscriber.id}>
                  <TableCell>
                    <p className="font-medium text-white">{subscriber.email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={subscriber.verified ? "success" : "warning"}>
                      {subscriber.verified ? "Verified" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(subscriber.createdAt), "PP")}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleDelete(subscriber.id)}
                      className="p-1 text-navy-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
