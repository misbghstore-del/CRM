import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Circle } from 'lucide-react'

export default async function TasksPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: tasks } = await supabase
        .from('tasks')
        .select('*, customers(name)')
        .eq('user_id', user?.id)
        .order('due_date', { ascending: true })

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">My Tasks</h1>

            <div className="grid gap-4">
                {tasks?.map((task) => (
                    <Card key={task.id}>
                        <CardContent className="flex items-center p-4">
                            <div className="mr-4 text-muted-foreground">
                                {task.is_completed ? (
                                    <CheckCircle2 className="h-6 w-6 text-green-500" />
                                ) : (
                                    <Circle className="h-6 w-6" />
                                )}
                            </div>
                            <div className="flex-1">
                                <p className={`font-medium ${task.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                    {task.description}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {task.customers?.name} • Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
