import { Button } from "@veyra/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@veyra/ui";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Veyra
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            Developer-First AI Platform for Building Software Systems
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Plan</CardTitle>
              <CardDescription>
                AI-powered task decomposition and planning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Break down complex tasks into actionable steps with intelligent planning.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Build</CardTitle>
              <CardDescription>
                Execute tasks with agentic orchestration
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Leverage multi-agent systems to execute complex workflows reliably.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deploy</CardTitle>
              <CardDescription>
                Ship with confidence and observability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Full observability, tracing, and rollback awareness for production deployments.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <Button size="lg">Get Started</Button>
        </div>
      </div>
    </main>
  );
}
