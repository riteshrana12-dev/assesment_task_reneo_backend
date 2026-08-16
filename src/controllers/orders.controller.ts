import { Request, Response } from "express";
import * as ordersService from "../services/orders.service";

export async function create(req: Request, res: Response) {
  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
  const orderId = await ordersService.createOrder(
    req.supabase!,
    req.body.items,
    idempotencyKey,
  );
  const order = await ordersService.getOrder(req.supabase!, orderId);
  res.status(201).json({ data: order });
}

export async function getOne(req: Request, res: Response) {
  const order = await ordersService.getOrder(
    req.supabase!,
    req.params.id as string,
  );
  res.status(200).json({ data: order });
}

export async function listMine(req: Request, res: Response) {
  const orders = await ordersService.listMyOrders(req.supabase!);
  res.status(200).json({ data: orders });
}
