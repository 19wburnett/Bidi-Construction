// Test script to insert a drawing record directly
const testRecord = {
  plan_id: 'test-plan-id',
  user_id: 'test-user-id', 
  page_number: 1,
  drawing_data: {
    id: 'test-drawing-123',
    type: 'comment',
    geometry: { x: 100, y: 200 },
    style: { color: '#3b82f6', strokeWidth: 2, opacity: 1 },
    pageNumber: 1,
    notes: 'Test comment',
    noteType: 'requirement',
    category: 'Electrical',
    location: 'Page 1',
    userId: 'test-user-id',
    userName: 'test@example.com',
    createdAt: new Date().toISOString(),
    isVisible: true,
    isLocked: false,
    zIndex: 0
  }
}

console.log('Test record structure:')
console.log(JSON.stringify(testRecord, null, 2))

