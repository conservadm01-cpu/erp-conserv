import type { RentalOption } from "@/lib/types";
import { ProviderNotConfigured } from "./errors";
import type { CarParams, CarRentalSearchProvider, ProviderResponse } from "./types";

/**
 * Não há API pública e aberta de locadoras com termos que permitam integração direta.
 * Este provedor sinaliza "não configurado"; a interface permite plugar um parceiro
 * (ex.: programa de afiliados com API) sem mudar as telas.
 */
export class NoCarRentalProvider implements CarRentalSearchProvider {
  readonly key = "nenhum";
  readonly name = "Locação de veículos";
  isConfigured() {
    return false;
  }
  async searchCars(_p: CarParams): Promise<ProviderResponse<RentalOption>> {
    throw new ProviderNotConfigured(this.name);
  }
}
