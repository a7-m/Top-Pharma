// Authentication Service

/**
 * Sign up a new user
 */
async function signUp(email, password, fullName) {
    try {
        // Create user account
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (authError) throw authError;

        // Profile is created automatically by database trigger 'on_auth_user_created'
        // No need for client-side insert which was causing the duplicate key error


        return { data: authData, error: null };
    } catch (error) {
        return { data: null, error: error };
    }
}

/**
 * Sign in user
 */
async function signIn(email, password) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;
        
        // Check Role & Subscription
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role, is_paid, paid_until')
            .eq('id', data.user.id)
            .single();

        if (profile && profile.role === 'admin') {
            window.location.href = 'admin/index.html';
        } else {
            window.location.href = 'dashboard.html';
        }
        
        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

/**
 * Sign in user with Google
 */
async function signInWithGoogle() {
    try {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + '/index.html'
            }
        });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

/**
 * Sign out user
 */
async function signOut() {
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        window.location.href = 'index.html';
    } catch (error) {
        showError('حدث خطأ أثناء تسجيل الخروج');
    }
}

/**
 * Get current user
 */
async function getCurrentUser() {
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        return user;
    } catch (error) {
        return null;
    }
}

/**
 * Get current session
 */
async function getSession() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session;
    } catch (error) {
        return null;
    }
}

/**
 * Require authentication - Redirect to login if not authenticated
 */
async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }

    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role, is_paid, paid_until')
        .eq('id', session.user.id)
        .single();

    if (profile && profile.role === 'admin') {
        return true;
    }

    return true;
}

/**
 * Get user profile
 */
async function getUserProfile(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
}

/**
 * Check if user is already logged in and redirect to dashboard
 */
async function redirectIfAuthenticated() {
    const session = await getSession();
    if (session) {
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role, is_paid, paid_until')
            .eq('id', session.user.id)
            .single();

        if (profile && profile.role === 'admin') {
            window.location.href = 'admin/index.html';
        } else {
            window.location.href = 'dashboard.html';
        }
    }
}
