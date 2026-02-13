import mongoose, { Schema, Document, model } from "mongoose";

interface IUser extends Document {
    email: string;
    name: string;
    role: string;
    favorites: mongoose.Types.ObjectId[];
    cart: mongoose.Types.ObjectId[];
    cartExpiresAt?: Date;
}
const UserSchema = new Schema<IUser>({
    email: { type: String, required: true, unique: true },
    name: String,
    role: String,
    favorites: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    cart: [{ type: Schema.Types.ObjectId }],
    cartExpiresAt: { type: Date },
});
const User = mongoose.models.User || model<IUser>("User", UserSchema);
export default User;