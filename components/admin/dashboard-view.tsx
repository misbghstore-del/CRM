'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { getDashboardStats } from '@/app/actions/admin'
import { Loader2, Users, TrendingUp, Briefcase, Calendar } from 'lucide-react'

export default function DashboardView() {
    const [stats, setStats] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview')

    useEffect(() => {
        const fetchStats = async () => {
            const result = await getDashboardStats()
            if (result.success) {
                setStats(result.stats)
            }
            setLoading(false)
        }
        fetchStats()
    }, [])

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!stats) return <div>Failed to load stats</div>

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-100">Total Customers</CardTitle>
                        <Users className="h-4 w-4 text-blue-100" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.kpi.totalCustomers}</div>
                        <p className="text-xs text-blue-100">+20.1% from last month</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-100">Win Rate</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-100" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.kpi.winRate}%</div>
                        <p className="text-xs text-green-100">+4% from last month</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-purple-100">Open Deals</CardTitle>
                        <Briefcase className="h-4 w-4 text-purple-100" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.kpi.openDeals}</div>
                        <p className="text-xs text-purple-100">Active pipeline</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-orange-100">Total Visits</CardTitle>
                        <Calendar className="h-4 w-4 text-orange-100" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.kpi.totalVisits}</div>
                        <p className="text-xs text-orange-100">Logged interactions</p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="flex items-center p-1 bg-muted rounded-lg w-fit">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'overview'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('agents')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'agents'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        Agents Performance
                    </button>
                </div>

                {activeTab === 'overview' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Sales Pipeline</CardTitle>
                            <CardDescription>Distribution of customers by stage</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {stats.pipeline.map((stage: any) => (
                                    <div key={stage.name} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{stage.name}</span>
                                            <span className="text-muted-foreground">{stage.value}</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                                            <div
                                                className="h-full bg-primary transition-all duration-500 ease-in-out"
                                                style={{
                                                    width: `${stats.kpi.totalCustomers > 0 ? (stage.value / stats.kpi.totalCustomers) * 100 : 0}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'agents' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>BDM Performance</CardTitle>
                            <CardDescription>Detailed metrics per agent</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-muted text-muted-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Agent Name</th>
                                            <th className="px-4 py-3 font-medium text-center">Total Leads</th>
                                            <th className="px-4 py-3 font-medium text-center">Active</th>
                                            <th className="px-4 py-3 font-medium text-center">Closed</th>
                                            <th className="px-4 py-3 font-medium text-center">Win Rate</th>
                                            <th className="px-4 py-3 font-medium text-center">Visits</th>
                                            <th className="px-4 py-3 font-medium text-center">Pending Tasks</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {stats.agents.map((agent: any) => (
                                            <tr key={agent.id} className="hover:bg-muted/50">
                                                <td className="px-4 py-3 font-medium">{agent.name}</td>
                                                <td className="px-4 py-3 text-center">{agent.totalLeads}</td>
                                                <td className="px-4 py-3 text-center text-blue-600 font-medium">{agent.activeLeads}</td>
                                                <td className="px-4 py-3 text-center text-green-600 font-medium">{agent.closedDeals}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${agent.winRate >= 50 ? 'bg-green-100 text-green-800' :
                                                            agent.winRate >= 20 ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-red-100 text-red-800'
                                                        }`}>
                                                        {agent.winRate}%
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">{agent.totalVisits}</td>
                                                <td className="px-4 py-3 text-center text-orange-600">{agent.pendingTasks}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
