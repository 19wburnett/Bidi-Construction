'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { Search, Users, Network, Mail, MapPin, Building2, Phone, CheckCircle } from 'lucide-react'

interface Subcontractor {
  id: string
  email: string
  name: string
  company: string | null
  phone: string | null
  trade_category: string
  location: string
  notes?: string | null
}

interface SubcontractorSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  tradeCategory: string
  location: string
  onConfirm: (selectedContacts: string[], selectedNetwork: string[]) => void
  initialSelectedContacts?: string[]
  initialSelectedNetwork?: string[]
}

export default function SubcontractorSelectionModal({
  isOpen,
  onClose,
  tradeCategory,
  location,
  onConfirm,
  initialSelectedContacts = [],
  initialSelectedNetwork = []
}: SubcontractorSelectionModalProps) {
  const [activeTab, setActiveTab] = useState<'contacts' | 'network'>('contacts')
  const [myContacts, setMyContacts] = useState<Subcontractor[]>([])
  const [networkSubs, setNetworkSubs] = useState<Subcontractor[]>([])
  const [selectedContacts, setSelectedContacts] = useState<string[]>(initialSelectedContacts)
  const [selectedNetwork, setSelectedNetwork] = useState<string[]>(initialSelectedNetwork)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (isOpen && tradeCategory) {
      fetchSubcontractors()
    }
  }, [isOpen, tradeCategory])

  const fetchSubcontractors = async () => {
    setLoading(true)
    try {
      // Fetch my contacts - only filter by trade category
      const { data: contacts } = await supabase
        .from('gc_contacts')
        .select('*')
        .eq('trade_category', tradeCategory)

      // Fetch Bidi network subcontractors - only filter by trade category
      const { data: network } = await supabase
        .from('subcontractors')
        .select('*')
        .eq('trade_category', tradeCategory)

      setMyContacts(contacts || [])
      setNetworkSubs(network || [])

      // Initialize selections if not already set
      if (initialSelectedContacts.length === 0 && contacts && contacts.length > 0) {
        setSelectedContacts(contacts.map(c => c.email))
      }
      if (initialSelectedNetwork.length === 0 && network && network.length > 0) {
        setSelectedNetwork(network.map(n => n.email))
      }
    } catch (error) {
      console.error('Error fetching subcontractors:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleContact = (email: string) => {
    setSelectedContacts(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const toggleNetwork = (email: string) => {
    setSelectedNetwork(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const toggleAllContacts = () => {
    if (selectedContacts.length === myContacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(myContacts.map(c => c.email))
    }
  }

  const toggleAllNetwork = () => {
    if (selectedNetwork.length === networkSubs.length) {
      setSelectedNetwork([])
    } else {
      setSelectedNetwork(networkSubs.map(n => n.email))
    }
  }

  const handleConfirm = () => {
    onConfirm(selectedContacts, selectedNetwork)
    onClose()
  }

  const filterSubcontractors = (subs: Subcontractor[]) => {
    if (!searchTerm) return subs
    const term = searchTerm.toLowerCase()
    return subs.filter(sub => 
      sub.name.toLowerCase().includes(term) ||
      sub.email.toLowerCase().includes(term) ||
      (sub.company && sub.company.toLowerCase().includes(term)) ||
      sub.location.toLowerCase().includes(term)
    )
  }

  const filteredContacts = filterSubcontractors(myContacts)
  const filteredNetwork = filterSubcontractors(networkSubs)

  const SubcontractorCard = ({ 
    sub, 
    isSelected, 
    onToggle,
    type 
  }: { 
    sub: Subcontractor
    isSelected: boolean
    onToggle: () => void
    type: 'contact' | 'network'
  }) => (
    <div
      onClick={onToggle}
      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
        isSelected 
          ? 'border-orange-500 bg-orange-50 shadow-sm' 
          : 'border-gray-200 bg-white hover:border-orange-300'
      }`}
    >
      {isSelected ? (
        <div className="absolute top-3 right-3 bg-orange-500 rounded-full p-1">
          <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ) : (
        <div className="absolute top-3 right-3 w-6 h-6 rounded-full border-2 border-gray-300"></div>
      )}
      
      <div className="mb-3 pr-8">
        <h3 className="font-semibold text-base text-gray-900 leading-tight">{sub.name}</h3>
        {sub.company && (
          <div className="flex items-center text-sm text-gray-600 mt-1.5">
            <Building2 className="h-4 w-4 mr-1.5 text-gray-400" />
            <span className="font-medium">{sub.company}</span>
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center">
          <Mail className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" />
          <span className="truncate">{sub.email}</span>
        </div>
        
        {sub.phone && (
          <div className="flex items-center">
            <Phone className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" />
            <span>{sub.phone}</span>
          </div>
        )}
        
        <div className="flex items-center">
          <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-gray-400" />
          <span className="text-gray-500">{sub.location}</span>
        </div>
      </div>

      {sub.notes && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 italic line-clamp-2">
            {sub.notes}
          </p>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-200">
        <Badge 
          variant={type === 'contact' ? 'default' : 'secondary'} 
          className={`text-xs ${type === 'contact' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' : 'bg-gray-100 text-gray-700 hover:bg-gray-100'}`}
        >
          {type === 'contact' ? (
            <><Users className="h-3 w-3 mr-1 inline" />My Contact</>
          ) : (
            <><Network className="h-3 w-3 mr-1 inline" />Bidi Network</>
          )}
        </Badge>
      </div>
    </div>
  )

  const totalSelected = selectedContacts.length + selectedNetwork.length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-2xl font-bold">Select Subcontractors</DialogTitle>
          <DialogDescription className="text-base">
            Choose which subcontractors to send this bid request to
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex space-x-1 border-b px-6">
          <button
            onClick={() => setActiveTab('contacts')}
            className={`px-5 py-3 font-medium transition-all relative -mb-px ${
              activeTab === 'contacts'
                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>My Contacts</span>
              <span className="text-xs text-gray-500">({myContacts.length})</span>
              {selectedContacts.length > 0 && (
                <Badge className="ml-1 bg-orange-600 text-white hover:bg-orange-600">
                  {selectedContacts.length}
                </Badge>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`px-5 py-3 font-medium transition-all relative -mb-px ${
              activeTab === 'network'
                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Network className="h-4 w-4" />
              <span>Bidi Network</span>
              <span className="text-xs text-gray-500">({networkSubs.length})</span>
              {selectedNetwork.length > 0 && (
                <Badge className="ml-1 bg-orange-600 text-white hover:bg-orange-600">
                  {selectedNetwork.length}
                </Badge>
              )}
            </div>
          </button>
        </div>

        {/* Search and Actions */}
        <div className="flex items-center justify-between gap-3 py-4 px-6 bg-gray-50 border-b">
          <Input
            placeholder="Search by name, company, email, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            className="flex-1 bg-white"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={activeTab === 'contacts' ? toggleAllContacts : toggleAllNetwork}
            className="whitespace-nowrap"
          >
            {activeTab === 'contacts'
              ? selectedContacts.length === myContacts.length ? 'Deselect All' : 'Select All'
              : selectedNetwork.length === networkSubs.length ? 'Deselect All' : 'Select All'
            }
          </Button>
        </div>

        {/* Subcontractor List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mx-auto mb-3"></div>
                <p className="text-gray-500">Loading subcontractors...</p>
              </div>
            </div>
          ) : activeTab === 'contacts' ? (
            filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="bg-gray-100 rounded-full p-6 mb-4">
                  <Users className="h-12 w-12 text-gray-400" />
                </div>
                <p className="text-gray-900 font-semibold text-lg mb-1">No contacts found</p>
                <p className="text-sm text-gray-500">
                  {myContacts.length === 0 
                    ? `No contacts available for ${tradeCategory}`
                    : 'Try adjusting your search'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredContacts.map((contact) => (
                  <SubcontractorCard
                    key={contact.id}
                    sub={contact}
                    isSelected={selectedContacts.includes(contact.email)}
                    onToggle={() => toggleContact(contact.email)}
                    type="contact"
                  />
                ))}
              </div>
            )
          ) : (
            filteredNetwork.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="bg-gray-100 rounded-full p-6 mb-4">
                  <Network className="h-12 w-12 text-gray-400" />
                </div>
                <p className="text-gray-900 font-semibold text-lg mb-1">No network subcontractors found</p>
                <p className="text-sm text-gray-500">
                  {networkSubs.length === 0
                    ? `No Bidi network subcontractors available for ${tradeCategory}`
                    : 'Try adjusting your search'
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredNetwork.map((sub) => (
                  <SubcontractorCard
                    key={sub.id}
                    sub={sub}
                    isSelected={selectedNetwork.includes(sub.email)}
                    onToggle={() => toggleNetwork(sub.email)}
                    type="network"
                  />
                ))}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="text-sm">
            <span className="font-semibold text-gray-900 text-base">{totalSelected}</span>
            <span className="text-gray-600"> subcontractor{totalSelected !== 1 ? 's' : ''} selected</span>
            {totalSelected > 0 && (
              <>
                <span className="text-gray-400 mx-2">•</span>
                <span className="text-gray-600">
                  {selectedContacts.length} {selectedContacts.length === 1 ? 'contact' : 'contacts'}, {selectedNetwork.length} network
                </span>
              </>
            )}
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={onClose} size="lg">
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={totalSelected === 0}
              size="lg"
              className="min-w-[160px] bg-orange-600 hover:bg-orange-700 text-white"
            >
              Confirm Selection
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
