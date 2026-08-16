import { Request, Response } from "express";
import * as productsService from "../services/products.service";

export async function create(req: Request, res: Response) {
  const product = await productsService.createProduct(
    req.supabase!,
    req.user!.id,
    req.body,
  );
  res.status(201).json({ data: product });
}

export async function list(req: Request, res: Response) {
  const query = (req as any).validatedQuery ?? req.query;
  const result = await productsService.listProducts(req.supabase!, query);
  res.status(200).json(result);
}

export async function getOne(req: Request, res: Response) {
  const product = await productsService.getProduct(
    req.supabase!,
    req.params.id as string,
  );
  res.status(200).json({ data: product });
}

export async function update(req: Request, res: Response) {
  const product = await productsService.updateProduct(
    req.supabase!,
    req.params.id as string,
    req.body,
  );
  res.status(200).json({ data: product });
}

export async function archive(req: Request, res: Response) {
  const product = await productsService.archiveProduct(
    req.supabase!,
    req.params.id as string,
  );
  res.status(200).json({ data: product });
}
