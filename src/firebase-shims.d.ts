declare module 'firebase/app' {
  export function initializeApp(config: any): any;
}

declare module 'firebase/auth' {
  export function getAuth(app?: any): any;
  export function onAuthStateChanged(auth: any, callback: (user: any) => void): () => void;
  export function signOut(auth: any): Promise<void>;
  export function signInWithEmailAndPassword(auth: any, email: string, password: string): Promise<any>;
  export function createUserWithEmailAndPassword(auth: any, email: string, password: string): Promise<any>;
}

declare module 'firebase/firestore' {
  export function getFirestore(app?: any, databaseId?: string): any;
  export function collection(...args: any[]): any;
  export function query(...args: any[]): any;
  export function where(...args: any[]): any;
  export function orderBy(...args: any[]): any;
  export function onSnapshot(source: any, onNext: (snapshot: any) => void, onError?: (error: any) => void): () => void;
  export function doc(...args: any[]): any;
  export function addDoc(ref: any, data: any): Promise<any>;
  export function setDoc(ref: any, data: any): Promise<void>;
  export function getDoc(ref: any): Promise<any>;
  export function getDocs(query: any): Promise<any>;
  export function updateDoc(ref: any, data: any): Promise<void>;
  export function deleteDoc(ref: any): Promise<void>;
  export function writeBatch(db: any): {
    set(ref: any, data: any): void;
    update(ref: any, data: any): void;
    delete(ref: any): void;
    commit(): Promise<void>;
  };
}
