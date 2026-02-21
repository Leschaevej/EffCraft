import mongoose, { Schema, Document, model } from "mongoose";

interface IUser extends Document {
    email: string;
    name: string;
    role: string;
    favorites: mongoose.Types.ObjectId[];
    cart: mongoose.Types.ObjectId[];
    cartExpiresAt?: Date;
    magicLinkToken?: string;
    magicLinkTokenExpires?: Date;
    magicLinkTokenUsed?: boolean;
    magicLinkCallbackUrl?: string;
    magicSessionToken?: string;
    magicSessionTokenExpires?: Date;
}
const UserSchema = new Schema<IUser>({
    email: { type: String, required: true, unique: true },
    name: String,
    role: String,
    favorites: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    cart: [{ type: Schema.Types.ObjectId }],
    cartExpiresAt: { type: Date },
    magicLinkToken: { type: String },
    magicLinkTokenExpires: { type: Date },
    magicLinkTokenUsed: { type: Boolean },
    magicLinkCallbackUrl: { type: String },
    magicSessionToken: { type: String },
    magicSessionTokenExpires: { type: Date },
});
const User = (mongoose.models.User as mongoose.Model<IUser>) || model<IUser>("User", UserSchema);
export default User;
