import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('EFFCRAFT API is running');
});

mongoose.connect(process.env.DATABASE as string)
  .then(() => {
    console.log('MongoDB connected');

    const PORT = process.env.PORT as string;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => console.error('MongoDB connection failed:', err));