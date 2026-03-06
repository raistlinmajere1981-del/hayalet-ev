import type { AppSettings } from "@shared/settings.js";

interface ProviderOption {
  id: string;
  name: string;
}

interface PopulateProviderSelectOptions {
  providerSelect: HTMLSelectElement | null;
  providers: unknown[];
  settings: AppSettings | null;
  isProviderOption: (value: unknown) => value is ProviderOption;
}

export function populateAsistanProviderSelect({
  providerSelect,
  providers,
  settings,
  isProviderOption,
}: PopulateProviderSelectOptions): void {
  if (providerSelect == null) {
    return;
  }

  providerSelect.innerHTML = "";

  providers.forEach((provider) => {
    if (!isProviderOption(provider)) {
      return;
    }

    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = provider.name;
    providerSelect.appendChild(option);
  });

  const asistanAccounts = settings?.asistanAccounts as { id: string; provider?: string }[] | undefined;
  const asistanSlot = settings?.asistanSlot as { accountId?: string } | undefined;
  const account = asistanAccounts?.find((entry) => entry.id === asistanSlot?.accountId);
  if (
    account?.provider !== undefined &&
    account.provider !== "" &&
    providerSelect.querySelector(`option[value="${account.provider}"]`) !== null
  ) {
    providerSelect.value = account.provider;
  }
}
