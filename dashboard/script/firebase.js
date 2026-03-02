
const firebaseConfig = {
  apiKey: "AIzaSyBUSsUx_gStTgVG97PvEBCY-KVbhpYFd-Y",
  authDomain: "ennovyxapp.firebaseapp.com",
  projectId: "ennovyxapp",
  storageBucket: "ennovyxapp.firebasestorage.app",
  messagingSenderId: "315135040726",
  appId: "1:315135040726:web:60bbd2e689c4b6cdaefd77",
  measurementId: "G-SGQK7RBZY7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Auth state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('User logged in:', user.uid);
        // User is signed in
        window.currentUser = user;
        // Initialize data manager after user is authenticated
        if (typeof initializeDataManager === 'function') {
            initializeDataManager();
        }
    } else {
        console.log('No user logged in');
        // No user is signed in - redirect to signup
        if (!window.location.href.includes('signup.html')) {
            window.location.href = 'signup.html';
        }
    }
});

// Export for use in other files
window.auth = auth;
window.db = db;
