import { notFound } from "next/navigation";
import { AppError } from "./errors";

/** Converte "não encontrado" do serviço na página 404 do Next. */
export async function orNotFound<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}
