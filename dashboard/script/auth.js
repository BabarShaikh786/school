// Sign Up Function — receives name (no confirm password)
async function signUp(email, password, name) {
    if (password.length < 6) {
        alert('Password must be at least 6 characters long');
        return;
    }

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        // Set Firebase display name
        await user.updateProfile({ displayName: name });
        
        // Create user document in Firestore
        await db.collection('users').doc(user.uid).set({
            email: email,
            name: name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Initialize empty data structure for new user
        await initializeUserData(user.uid);

        // Send welcome email with real name
        fetch('/api/email/welcome', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ email: email, name: name })
        }).catch(() => {});

        alert('Account created successfully! Welcome, ' + name + '!');
        window.location.href = '/dashboard';
    } catch (error) {
        console.error('Sign up error:', error);
        alert(error.message);
    }
}

// Login Function
async function login(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update last login
        await db.collection('users').doc(user.uid).update({
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.location.href = '/dashboard';
    } catch (error) {
        console.error('Login error:', error);
        alert(error.message);
    }
}

// Logout Function
async function logout() {
    try {
        await auth.signOut();
        window.location.href = '/signup/index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert(error.message);
    }
}

// Initialize user data structure
async function initializeUserData(userId) {
    const batch = db.batch();

    // Create empty collections references
    const userRef = db.collection('users').doc(userId);
    
    batch.set(userRef.collection('tasks').doc('_init'), { initialized: true });
    batch.set(userRef.collection('subjects').doc('_init'), { initialized: true });
    batch.set(userRef.collection('documents').doc('_init'), { initialized: true });
    batch.set(userRef.collection('calendar').doc('_init'), { initialized: true });
    batch.set(userRef.collection('expenses').doc('_init'), { initialized: true });
    batch.set(userRef.collection('habits').doc('_init'), { initialized: true });
    batch.set(userRef.collection('settings').doc('preferences'), {
        budget: 0,
        notifications: {
            email: true,
            dailySummary: true,
            summaryTime: '06:00'
        }
    });

    await batch.commit();
}

// Export functions
window.signUp = signUp;
window.login = login;
window.logout = logout;