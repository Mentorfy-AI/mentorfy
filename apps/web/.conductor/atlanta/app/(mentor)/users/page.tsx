import { getUserProfiles } from '@/lib/data/users'
import { UsersList } from '@/components/users/users-list'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function UsersPage() {
  try {
    const users = await getUserProfiles()

    return (
      <div className="p-6 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage your users</p>
        </div>

        <UsersList initialUsers={users} />
      </div>
    )
  } catch (error) {
    console.error('Error loading users:', error)
    return (
      <div className="p-6 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">Manage your users</p>
        </div>
        <div className="text-center py-12">
          <p className="text-red-500">Error loading users: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    )
  }
}
