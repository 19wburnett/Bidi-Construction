'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { User, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  role?: string
  created_at?: string
}

export default function UserMasqueradeSelector() {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [masquerading, setMasquerading] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const router = useRouter()

  useEffect(() => {
    // Check if already masquerading
    fetch('/api/admin/masquerade/status')
      .then(res => res.json())
      .then(data => {
        setMasquerading(data.isMasquerading)
        if (data.isMasquerading && data.targetUserId) {
          setSelectedUserId(data.targetUserId)
        }
      })
      .catch(err => console.error('Error checking masquerade status:', err))
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      
      if (data.success && data.users) {
        setUsers(data.users)
      }
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMasquerade = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/masquerade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ targetUserId: userId }),
      })

      if (response.ok) {
        setOpen(false)
        // Refresh the page to update auth state
        router.refresh()
        window.location.reload()
      } else {
        const error = await response.json()
        console.error('Failed to start masquerade:', error)
        alert(`Failed to masquerade: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error starting masquerade:', error)
      alert('Failed to start masquerade')
    }
  }

  const selectedUser = users.find(u => u.id === selectedUserId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[250px] justify-between"
          onClick={() => {
            if (!open) {
              loadUsers()
            }
          }}
        >
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="truncate">
              {masquerading && selectedUser
                ? `Masquerading as ${selectedUser.email}`
                : 'Masquerade as User...'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search users by email..." />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                <CommandEmpty>No users found.</CommandEmpty>
                <CommandGroup>
                  {users.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={user.email}
                      onSelect={() => {
                        setSelectedUserId(user.id)
                        handleMasquerade(user.id)
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex flex-col">
                        <span>{user.email}</span>
                        {user.role && (
                          <span className="text-xs text-gray-500">{user.role}</span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          'h-4 w-4',
                          selectedUserId === user.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

