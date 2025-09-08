// Setup script to make a user admin
// Run this with: node setup-admin.js

const { createClient } = require('@supabase/supabase-js')

// You'll need to set these environment variables or replace with your actual values
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role key for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setUserAsAdmin(email) {
  try {
    console.log(`Setting user ${email} as admin...`)
    
    // First, check if user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', email)
      .single()

    if (userError) {
      console.error('Error finding user:', userError.message)
      return false
    }

    if (!user) {
      console.error('User not found')
      return false
    }

    // Update user to admin
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        is_admin: true, 
        role: 'admin',
        demo_mode: true // Enable demo mode by default
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating user:', updateError.message)
      return false
    }

    console.log(`✅ Successfully set ${email} as admin with demo mode enabled`)
    return true
  } catch (error) {
    console.error('Unexpected error:', error.message)
    return false
  }
}

// Get email from command line arguments
const email = process.argv[2]

if (!email) {
  console.log('Usage: node setup-admin.js <email>')
  console.log('Example: node setup-admin.js your-email@example.com')
  process.exit(1)
}

// Run the setup
setUserAsAdmin(email)
  .then(success => {
    if (success) {
      console.log('\n🎉 Setup complete! You can now:')
      console.log('1. Log in with your admin account')
      console.log('2. Go to the Admin section in the navbar')
      console.log('3. Toggle demo mode on/off as needed')
      console.log('4. Create job requests to see demo bids appear automatically')
    } else {
      console.log('\n❌ Setup failed. Please check the error messages above.')
    }
  })
  .catch(error => {
    console.error('Setup failed:', error.message)
  })


