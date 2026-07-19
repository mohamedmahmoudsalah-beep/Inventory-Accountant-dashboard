import { Clock, BarChart3, Database, User } from "lucide-react";

const activities = [
  { icon: BarChart3, text: "New dashboard created", time: "2 min ago", color: "text-blue-500" },
  { icon: Database, text: "Dataset refreshed", time: "15 min ago", color: "text-green-500" },
  { icon: User, text: "New member added", time: "1 hour ago", color: "text-purple-500" },
];

export function RecentActivity() {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
      </div>
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-accent flex items-center justify-center ${activity.color}`}>
              <activity.icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground">{activity.text}</p>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
