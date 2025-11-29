import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function KPIPage() {
    return (
        <div className="space-y-6">
            <Card className="rounded-3xl border-none shadow-sm ring-1 ring-border">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-lime-500">KPI Report</CardTitle>
                </CardHeader>
                <CardContent className="flex min-h-[400px] flex-col items-center justify-center text-center">
                    <div className="mb-4 rounded-full bg-primary/10 p-6">
                        <BarChart3 className="h-12 w-12 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">Performance Metrics Coming Soon</h3>
                    <p className="mt-2 text-muted-foreground max-w-md">
                        We are building comprehensive reports to track your visits, tasks, and customer engagement. Check back later!
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
