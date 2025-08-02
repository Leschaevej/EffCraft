import mongoose, { Schema, Document, model } from "mongoose";

interface CartItem {
    productId: mongoose.Types.ObjectId;
    addedAt: Date;
}
interface IUser extends Document {
    email: string;
    name: string;
    role: string;
    favorites: mongoose.Types.ObjectId[];
    cart: CartItem[];
}
const CartItemSchema = new Schema<CartItem>({
    productId: { type: Schema.Types.ObjectId, required: true },
    addedAt: { type: Date, required: true },
});
const UserSchema = new Schema<IUser>({
    email: { type: String, required: true, unique: true },
    name: String,
    role: String,
    favorites: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    cart: { type: [CartItemSchema], default: [] },
});
const User = mongoose.models.User || model<IUser>("User", UserSchema);
export default User;