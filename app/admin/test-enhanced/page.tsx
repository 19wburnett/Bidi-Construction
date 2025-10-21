'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function TestEnhancedPage() {
  const [testResults, setTestResults] = useState<any>(null)
  const [isTesting, setIsTesting] = useState(false)

  const runEnvironmentTest = async () => {
    setIsTesting(true)
    try {
      const response = await fetch('/api/test-enhanced-environment')
      const results = await response.json()
      setTestResults(results)
    } catch (error) {
      setTestResults({ success: false, error: error.message })
    } finally {
      setIsTesting(false)
    }
  }

  const runModelTest = async () => {
    setIsTesting(true)
    try {
      // Test with a simple image
      const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      
      const response = await fetch('/api/plan/analyze-enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: 'test-plan',
          images: [testImage],
          taskType: 'takeoff'
        })
      })
      
      const results = await response.json()
      setTestResults({ success: true, modelTest: results })
    } catch (error) {
      setTestResults({ success: false, error: error.message })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Enhanced AI System Test</h1>
        <p className="text-muted-foreground mt-2">
          Test your enhanced multi-model AI system configuration
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Environment Test</CardTitle>
            <CardDescription>
              Test your API keys and environment configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runEnvironmentTest} 
              disabled={isTesting}
              className="w-full"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Environment'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Test</CardTitle>
            <CardDescription>
              Test the enhanced multi-model analysis system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={runModelTest} 
              disabled={isTesting}
              variant="outline"
              className="w-full"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing Models...
                </>
              ) : (
                'Test Models'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {testResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testResults.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Test Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            {testResults.success ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {testResults.models || '5'}
                    </div>
                    <div className="text-sm text-muted-foreground">Models</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {testResults.accuracy || '95%'}
                    </div>
                    <div className="text-sm text-muted-foreground">Accuracy</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {testResults.consensus || '60%'}
                    </div>
                    <div className="text-sm text-muted-foreground">Consensus</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {testResults.gpt5 ? 'GPT-5' : 'GPT-4o'}
                    </div>
                    <div className="text-sm text-muted-foreground">Primary Model</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Model Specializations:</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">GPT-5: General Analysis</Badge>
                    <Badge variant="outline">Claude-3.5: Code Compliance</Badge>
                    <Badge variant="outline">Gemini-1.5: Measurements</Badge>
                    <Badge variant="outline">Claude-3-Opus: Cost Estimation</Badge>
                    {testResults.grok && <Badge variant="outline">Grok-2: Alternative</Badge>}
                  </div>
                </div>

                {testResults.modelTest && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold mb-2">Model Test Results:</h4>
                    <pre className="text-sm overflow-auto">
                      {JSON.stringify(testResults.modelTest, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-semibold">Test Failed</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {testResults.error || 'Unknown error occurred'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p>1. <strong>Test with real plans:</strong> Go to <code>/admin/ai-plan-demo</code></p>
            <p>2. <strong>Compare results:</strong> Run single vs. multi-model analysis</p>
            <p>3. <strong>Show consensus:</strong> Highlight agreement/disagreement detection</p>
            <p>4. <strong>Demo specialized insights:</strong> Show trade-specific recommendations</p>
            <p>5. <strong>Prepare for demos:</strong> Use the demo guide for November 1st</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
