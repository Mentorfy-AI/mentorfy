import { getUserProfiles } from '@/lib/data/users'
import { UsersList } from '@/components/users/users-list'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function UsersPage() {
  try {
    const users = await getUserProfiles()

    return (
      <div className="px-6 pt-2 pb-6 h-full">
        <UsersList initialUsers={users} />
      </div>
    )
  } catch (error) {
    console.error('Error loading users:', error)
    return (
      <div className="px-6 pt-2 pb-6 h-full">
        <div className="text-center py-12">
          <p className="text-red-500">Error loading users: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </div>
    )
  }
}
