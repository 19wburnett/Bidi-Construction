'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase'

export default function SeedSubcontractorsPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')

  const supabase = createClient()

  const sampleSubcontractors = [
    {
      email: 'john@electricalpros.com',
      name: 'John Smith - Electrical Pros',
      trade_category: 'Electrical',
      location: 'Austin, TX'
    },
    {
      email: 'sarah@plumbingsolutions.com',
      name: 'Sarah Johnson - Plumbing Solutions',
      trade_category: 'Plumbing',
      location: 'Austin, TX'
    },
    {
      email: 'mike@hvacmaster.com',
      name: 'Mike Davis - HVAC Master',
      trade_category: 'HVAC',
      location: 'Austin, TX'
    },
    {
      email: 'lisa@roofingexpert.com',
      name: 'Lisa Wilson - Roofing Expert',
      trade_category: 'Roofing',
      location: 'Austin, TX'
    },
    {
      email: 'tom@concreteworks.com',
      name: 'Tom Brown - Concrete Works',
      trade_category: 'Concrete',
      location: 'Austin, TX'
    },
    {
      email: 'jane@paintingpros.com',
      name: 'Jane Miller - Painting Pros',
      trade_category: 'Painting',
      location: 'Austin, TX'
    },
    {
      email: 'bob@flooringspecialist.com',
      name: 'Bob Taylor - Flooring Specialist',
      trade_category: 'Flooring',
      location: 'Austin, TX'
    },
    {
      email: 'alex@drywallmaster.com',
      name: 'Alex Garcia - Drywall Master',
      trade_category: 'Drywall',
      location: 'Austin, TX'
    },
    {
      email: 'carl@carpentrypros.com',
      name: 'Carl Wilson - Carpentry Pros',
      trade_category: 'Carpentry',
      location: 'Austin, TX'
    },
    {
      email: 'maria@landscapingdesign.com',
      name: 'Maria Rodriguez - Landscaping Design',
      trade_category: 'Landscaping',
      location: 'Austin, TX'
    }
  ]

  const seedSubcontractors = async () => {
    setLoading(true)
    setResult('')

    try {
      const { data, error } = await supabase
        .from('subcontractors')
        .insert(sampleSubcontractors)
        .select()

      if (error) {
        setResult(`Error: ${error.message}`)
      } else {
        setResult(`Successfully added ${data?.length || 0} subcontractors to the database!`)
      }
    } catch (err) {
      setResult(`Error: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  const clearSubcontractors = async () => {
    setLoading(true)
    setResult('')

    try {
      const { error } = await supabase
        .from('subcontractors')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

      if (error) {
        setResult(`Error: ${error.message}`)
      } else {
        setResult('Successfully cleared all subcontractors from the database!')
      }
    } catch (err) {
      setResult(`Error: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Seed Subcontractors Database</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-600">
            This page helps you add sample subcontractors to test the email distribution system.
          </p>
          
          <div className="space-y-2">
            <Button 
              onClick={seedSubcontractors} 
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Adding...' : 'Add Sample Subcontractors'}
            </Button>
            
            <Button 
              onClick={clearSubcontractors} 
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? 'Clearing...' : 'Clear All Subcontractors'}
            </Button>
          </div>

          {result && (
            <div className={`p-4 rounded-md ${
              result.includes('Error') 
                ? 'bg-red-50 text-red-700 border border-red-200' 
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {result}
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-semibold mb-2">Sample Subcontractors:</h3>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {sampleSubcontractors.map((sub, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span>{sub.name}</span>
                  <span className="text-gray-500">{sub.trade_category}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
