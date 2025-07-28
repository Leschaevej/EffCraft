import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
    email: string;
    name?: string;
    role: "user" | "admin";
    favorites: string[];
    cart: { productId: string; quantity: number }[];
}
const UserSchema: Schema<IUser> = new Schema({
    email: { type: String, required: true, unique: true },
    name: String,
    role: { type: String, default: "user" },
    favorites: { type: [String], default: [] },
    cart: { type: [{ productId: String, quantity: Number }], default: [] },
});
const User: Model<IUser> = mongoose.models.User || mongoose.model("User", UserSchema);
export default User;