import mongoose, { Schema, Document, model } from "mongoose";

export interface IProduct extends Document {
    name: string;
    price: number;
    description: string;
    category: "necklace" | "earrings";
    images: string[];
    status: "available" | "reserved" | "sold";
    reservedBy?: mongoose.Types.ObjectId;
    reservedUntil?: Date;
    createdAt: Date;
}
const ProductSchema = new Schema<IProduct>({
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
    category: {
        type: String,
        required: true,
        enum: ["necklace", "earrings"]
    },
    images: [{ type: String }],
    status: {
        type: String,
        enum: ["available", "reserved", "sold"],
        default: "available"
    },
    reservedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reservedUntil: { type: Date },
    createdAt: { type: Date, default: Date.now }
});
ProductSchema.index({ status: 1 });
ProductSchema.index({ reservedUntil: 1 });
ProductSchema.index({ category: 1 });
const Product = mongoose.models.Product || model<IProduct>("Product", ProductSchema);
export default Product;