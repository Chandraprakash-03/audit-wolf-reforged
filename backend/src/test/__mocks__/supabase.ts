// Mock Supabase client for testing
export const mockSupabaseClient = {
	auth: {
		signUp: jest.fn(),
		signInWithPassword: jest.fn(),
		getUser: jest.fn(),
		refreshSession: jest.fn(),
		signOut: jest.fn(),
	},
	from: jest.fn(() => ({
		select: jest.fn().mockReturnThis(),
		insert: jest.fn().mockReturnThis(),
		update: jest.fn().mockReturnThis(),
		delete: jest.fn().mockReturnThis(),
		eq: jest.fn().mockReturnThis(),
		single: jest.fn(),
	})),
};

// Mock the createClient function
export const createClient = jest.fn(() => mockSupabaseClient);

// Export default mock
export default mockSupabaseClient;
