import { DatabaseService } from "../services/database";
import { User as UserType } from "../types/database";

export class UserModel {
	public id: string;
	public email: string;
	public name: string;
	public subscription_tier: "free" | "pro" | "enterprise";
	public api_credits: number;
	public created_at: Date;
	public updated_at: Date;

	constructor(data: UserType) {
		this.id = data.id;
		this.email = data.email;
		this.name = data.name;
		this.subscription_tier = data.subscription_tier;
		this.api_credits = data.api_credits;
		this.created_at = data.created_at;
		this.updated_at = data.updated_at;
	}

	static async create(userData: {
		email: string;
		name: string;
		subscription_tier?: "free" | "pro" | "enterprise";
		api_credits?: number;
	}): Promise<UserModel | null> {
		const user = await DatabaseService.createUser({
			email: userData.email,
			name: userData.name,
			subscription_tier: userData.subscription_tier || "free",
			api_credits: userData.api_credits || 10,
		});

		return user ? new UserModel(user) : null;
	}

	static async findById(id: string): Promise<UserModel | null> {
		const user = await DatabaseService.getUserById(id);
		return user ? new UserModel(user) : null;
	}

	async update(updates: {
		name?: string;
		subscription_tier?: "free" | "pro" | "enterprise";
		api_credits?: number;
	}): Promise<UserModel | null> {
		const updatedUser = await DatabaseService.updateUser(this.id, updates);
		if (updatedUser) {
			Object.assign(this, updatedUser);
			return this;
		}
		return null;
	}

	async deductCredits(amount: number): Promise<boolean> {
		if (this.api_credits < amount) {
			return false;
		}

		const updated = await this.update({
			api_credits: this.api_credits - amount,
		});

		return updated !== null;
	}

	async addCredits(amount: number): Promise<boolean> {
		const updated = await this.update({
			api_credits: this.api_credits + amount,
		});

		return updated !== null;
	}

	hasCredits(amount: number): boolean {
		return this.api_credits >= amount;
	}

	toJSON() {
		return {
			id: this.id,
			email: this.email,
			name: this.name,
			subscription_tier: this.subscription_tier,
			api_credits: this.api_credits,
			created_at: this.created_at,
			updated_at: this.updated_at,
		};
	}
}
