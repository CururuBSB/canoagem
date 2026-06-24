const DATA_PATHS = {
  recipes: "data/receitas.json",
  ingredients: "data/ingredientes.json",
  conversions: "data/conversoes.json",
};

const STORAGE_KEY = "despensa-de-bordo:planejamento";
const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

function readPlan() {
  const fallback = { participants: 1, days: 1, selections: {} };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== "object") return fallback;
    return {
      participants: positiveInteger(saved.participants, 1),
      days: positiveInteger(saved.days, 1),
      selections: saved.selections && typeof saved.selections === "object" ? saved.selections : {},
    };
  } catch {
    return fallback;
  }
}

function safePrint() {
  requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();
      });
  });
}

function savePlan(plan) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
}

function positiveInteger(value, fallback = 1) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Não foi possível carregar ${path}.`);
  return response.json();
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showError(container, message) {
  container.replaceChildren();
  const box = createElement("div", "error-box");
  box.append(
    createElement("strong", "", "Não foi possível exibir este conteúdo."),
    createElement("p", "", message),
  );
  container.append(box);
}

function displayName(value) {
  if (!value) return "";
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}

function formatQuantity(value) {
  return numberFormatter.format(Number(value));
}

function formatRecipeQuantity(value) {
  return numberFormatter.format(
    Number(value.toFixed(1))
  );
}

function categoryRank(category, categoryOrder) {
  const index = categoryOrder.indexOf(category);
  return index === -1 ? categoryOrder.length : index;
}

async function initPlanner() {
  const list = document.querySelector("#recipes-list");
  const participantsInput = document.querySelector("#participants");
  const daysInput = document.querySelector("#days");
  const status = document.querySelector("#meal-status");
  const plannedCount = document.querySelector("#planned-count");
  const daysCount = document.querySelector("#days-count");
  const statusMessage = document.querySelector("#status-message");
  const plan = readPlan();

  participantsInput.value = plan.participants;
  daysInput.value = plan.days;

  let recipes = [];

  function selectedTotal() {
    return Object.values(plan.selections).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  }

  function updateStatus() {
    plan.participants = positiveInteger(participantsInput.value, 1);
    plan.days = positiveInteger(daysInput.value, 1);
    participantsInput.value = plan.participants;
    daysInput.value = plan.days;

    const planned = selectedTotal();
    plannedCount.textContent = planned;
    daysCount.textContent = plan.days;
    status.classList.toggle("is-complete", planned === plan.days);
    status.classList.toggle("is-warning", planned !== plan.days);

    if (planned === plan.days) {
      statusMessage.textContent = "Planejamento completo.";
    } else if (planned < plan.days) {
      const missing = plan.days - planned;
      statusMessage.textContent = `Faltam ${missing} ${missing === 1 ? "refeição" : "refeições"}.`;
    } else {
      const extra = planned - plan.days;
      statusMessage.textContent = `${extra} ${extra === 1 ? "refeição excedente" : "refeições excedentes"}.`;
    }
    savePlan(plan);
  }

  function renderRecipes() {
    const grouped = new Map();
    recipes.forEach((recipe) => {
      if (!grouped.has(recipe.categoria)) grouped.set(recipe.categoria, []);
      grouped.get(recipe.categoria).push(recipe);
    });

    list.replaceChildren();
    grouped.forEach((items, category) => {
      const group = createElement("section", "recipe-group");
      group.append(createElement("h3", "recipe-category", category));
      const grid = createElement("div", "recipe-grid");

      items.forEach((recipe) => {
        const row = createElement("div", "recipe-row");
        const identity = createElement("div", "recipe-identity");
        const link = createElement("a", "recipe-link", displayName(recipe.nome));
        link.href = `receita.html?id=${encodeURIComponent(recipe.id)}`;
        link.target = "_blank";
        link.rel = "noopener";
        identity.append(
          link,
          createElement(
            "span",
            "recipe-yield",
            `Rende ${formatQuantity(recipe.rendimento)} ${recipe.rendimento === 1 ? "porção" : "porções"}`,
          ),
        );

        const counter = createElement("div", "counter");
        counter.setAttribute("aria-label", `Quantidade de ${recipe.nome}`);
        const decrease = createElement("button", "counter-button", "−");
        decrease.type = "button";
        decrease.dataset.action = "decrease";
        decrease.dataset.recipeId = recipe.id;
        decrease.setAttribute("aria-label", `Diminuir ${recipe.nome}`);
        const output = createElement("output", "counter-value", String(plan.selections[recipe.id] || 0));
        output.dataset.recipeId = recipe.id;
        const increase = createElement("button", "counter-button", "+");
        increase.type = "button";
        increase.dataset.action = "increase";
        increase.dataset.recipeId = recipe.id;
        increase.setAttribute("aria-label", `Aumentar ${recipe.nome}`);
        counter.append(decrease, output, increase);
        row.append(identity, counter);
        grid.append(row);
      });
      group.append(grid);
      list.append(group);
    });
  }

  list.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-recipe-id]");
    if (!button) return;
    const id = button.dataset.recipeId;
    const current = Math.max(0, Number(plan.selections[id]) || 0);
    plan.selections[id] = button.dataset.action === "increase" ? current + 1 : Math.max(0, current - 1);
    const output = list.querySelector(`output[data-recipe-id="${CSS.escape(id)}"]`);
    if (output) output.value = plan.selections[id];
    updateStatus();
  });

  [participantsInput, daysInput].forEach((input) => input.addEventListener("change", updateStatus));

  document.querySelector("#clear-plan").addEventListener("click", () => {
    plan.selections = {};
    list.querySelectorAll("output[data-recipe-id]").forEach((output) => { output.value = 0; });
    updateStatus();
  });

  document.querySelector("#calculate").addEventListener("click", () => {
    updateStatus();
    if (selectedTotal() === 0) {
      statusMessage.textContent = "Selecione ao menos uma receita para calcular.";
      status.classList.add("is-warning");
      status.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    window.open("compras.html", "_blank", "noopener");
  });

  document.querySelector("#recipe-book").addEventListener("click", () => {
    updateStatus();

    if (selectedTotal() === 0) {
      statusMessage.textContent = "Selecione ao menos uma receita para consultar.";
      status.classList.add("is-warning");
      status.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    window.open("livro.html", "_blank", "noopener");
  });

  try {
    const data = await fetchJson(DATA_PATHS.recipes);
    recipes = data.receitas;
    renderRecipes();
    updateStatus();
  } catch (error) {
    showError(list, `${error.message} Publique ou abra o projeto por um servidor web.`);
  }
}

async function initRecipe() {
  const container = document.querySelector("#recipe-detail");
  const recipeId = new URLSearchParams(window.location.search).get("id");
  if (!recipeId) {
    showError(container, "A receita não foi informada no endereço.");
    return;
  }

  try {
    const [recipeData, ingredientData] = await Promise.all([
      fetchJson(DATA_PATHS.recipes),
      fetchJson(DATA_PATHS.ingredients),
    ]);
    const recipe = recipeData.receitas.find((item) => item.id === recipeId);
    if (!recipe) throw new Error("Receita não encontrada.");
    
    const plan = readPlan();
    const participantes = plan.participants || recipe.rendimento;
    const fator = participantes / recipe.rendimento;

    const ingredients = new Map(ingredientData.ingredientes.map((item) => [item.id, item]));

    document.title = `${displayName(recipe.nome)} — Despensa de Bordo`;
    container.replaceChildren();

    const header = createElement("header", "recipe-detail-header");
    header.append(
      createElement("p", "recipe-badge", recipe.categoria),
      createElement("h1", "", displayName(recipe.nome)),
      //createElement("p", "recipe-serving", `Rendimento: ${formatQuantity(recipe.rendimento)} ${recipe.rendimento === 1 ? "porção" : "porções"}`),
      createElement("p", "recipe-serving", `Receita ajustada para: ${formatQuantity(participantes)} pessoa(s) - Base: ${formatQuantity(recipe.rendimento)} pessoas`),
    );

    const layout = createElement("div", "recipe-detail-grid");
    const ingredientSection = createElement("section", "recipe-card");
    ingredientSection.append(createElement("h2", "", "Ingredientes"));
    const ingredientList = createElement("ul", "ingredient-list");
    recipe.ingredientes.forEach((item) => {
      const metadata = ingredients.get(item.ingredienteId);
      const line = createElement("li", "");
      const quantidadeAjustada = item.quantidade * fator;
      line.append(
        createElement("span", "ingredient-name", displayName(metadata?.nome || item.ingredienteId)),
        
        //createElement("span", "ingredient-measure", `${formatQuantity(item.quantidade)} ${item.unidade}`),
        createElement("span", "ingredient-measure", `${formatRecipeQuantity(quantidadeAjustada)} ${item.unidade}`),
      );
      ingredientList.append(line);
    });
    ingredientSection.append(ingredientList);

    const instructions = createElement("section", "recipe-card preparation-card");
    instructions.append(
      createElement("h2", "", "Modo de preparo"),
      createElement("p", "preparation-text", recipe.modoPreparo || "Modo de preparo não informado."),
    );
    layout.append(ingredientSection, instructions);
    container.append(header, layout);
  } catch (error) {
    showError(container, error.message);
  }
}

async function initRecipeBook() {
  const container = document.querySelector("#recipe-book");
   
  document
  .querySelector("#print-book")
  .addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    safePrint();    
});
    
  const plan = readPlan();
 
  try {
    const [recipeData, ingredientData] = await Promise.all([
      fetchJson(DATA_PATHS.recipes),
      fetchJson(DATA_PATHS.ingredients),
    ]);

    const ingredients = new Map(
      ingredientData.ingredientes.map((item) => [item.id, item])
    );

    const selectedRecipes = recipeData.receitas.filter(
      (recipe) => (plan.selections[recipe.id] || 0) > 0
    );

    container.replaceChildren();

    if (selectedRecipes.length === 0) {
      container.append(
        createElement("p", "", "Nenhuma receita selecionada.")
      );
      return;
    }

    selectedRecipes.forEach((recipe) => {
      const fator = plan.participants / recipe.rendimento;

      const article = createElement("article", "recipe-detail");

      const header = createElement("header", "recipe-detail-header");
      header.append(
        //createElement("p", "recipe-badge", recipe.categoria),
        createElement("h1", "", displayName(recipe.nome)),
        createElement(
          "p",
          "recipe-serving",
          `Receita para ${plan.participants} remadores`
        )
      );

      const ingredientSection = createElement("section", "recipe-card");
      ingredientSection.append(createElement("h3", "", "Ingredientes"));

      const ingredientList = createElement("ul", "ingredient-list");

      recipe.ingredientes.forEach((item) => {
        const metadata = ingredients.get(item.ingredienteId);

        const quantidadeAjustada = item.quantidade * fator;

        const line = createElement("li", "");

        line.append(
          createElement(
            "span",
            "ingredient-name",
            displayName(metadata?.nome || item.ingredienteId)
          ),
          createElement(
            "span",
            "ingredient-measure",
            `${formatQuantity(quantidadeAjustada)} ${item.unidade}`
          )
        );

        ingredientList.append(line);
      });

      ingredientSection.append(ingredientList);

      const instructions = createElement(
        "section",
        "recipe-card preparation-card"
      );

      instructions.append(
        createElement("h3", "", "Modo de preparo"),
        createElement(
          "p",
          "preparation-text",
          recipe.modoPreparo || "Modo de preparo não informado."
        )
      );

      const layout = createElement("div", "recipe-detail-grid");
      layout.append(ingredientSection, instructions);

      article.append(header, layout);

      container.append(article);
    });
  } catch (error) {
    showError(container, error.message);
  }
}

function calculateShoppingList(plan, recipes, ingredients, conversions, categoryOrder) {
  const recipeMap = new Map(recipes.map((item) => [item.id, item]));
  const ingredientMap = new Map(ingredients.map((item) => [item.id, item]));
  const conversionMap = new Map(
    conversions.map((item) => [`${item.ingredienteId}\u0000${item.unidadeOrigem}`, item]),
  );
  const totals = new Map();

  Object.entries(plan.selections).forEach(([recipeId, preparations]) => {
    const recipe = recipeMap.get(recipeId);
    const count = Math.max(0, Number(preparations) || 0);
    if (!recipe || count === 0) return;
    const scale = (count * plan.participants) / recipe.rendimento;

    recipe.ingredientes.forEach((item) => {
      const conversion = conversionMap.get(`${item.ingredienteId}\u0000${item.unidade}`);
      if (!conversion) throw new Error(`Conversão ausente para ${item.ingredienteId} (${item.unidade}).`);
      const converted = item.quantidade * scale * conversion.fator;
      totals.set(item.ingredienteId, (totals.get(item.ingredienteId) || 0) + converted);
    });
  });

  return [...totals.entries()]
    .map(([id, total]) => {
      const ingredient = ingredientMap.get(id);
      if (!ingredient) throw new Error(`Cadastro ausente para o ingrediente ${id}.`);
      const purchaseQuantity = Math.ceil(total * ingredient.fatorCompra - 1e-10);
      return { ...ingredient, quantidadeCompra: purchaseQuantity };
    })
    .filter((item) => item.quantidadeCompra > 0)
    .sort((a, b) => categoryRank(a.categoria, categoryOrder) - categoryRank(b.categoria, categoryOrder) || a.nome.localeCompare(b.nome, "pt-BR"));
}

async function initShopping() {
  const container = document.querySelector("#shopping-list");
  const summary = document.querySelector("#trip-summary");
  const plan = readPlan();

  document
  .querySelector("#print-list")
  .addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    safePrint();
  });

  try {
    const [recipeData, ingredientData, conversionData] = await Promise.all([
      fetchJson(DATA_PATHS.recipes),
      fetchJson(DATA_PATHS.ingredients),
      fetchJson(DATA_PATHS.conversions),
    ]);
    const selectedMeals = Object.values(plan.selections).reduce((sum, value) => sum + (Number(value) || 0), 0);
    summary.textContent = `${plan.participants} ${plan.participants === 1 ? "participante" : "participantes"} · ${plan.days} ${plan.days === 1 ? "dia" : "dias"} · ${selectedMeals} ${selectedMeals === 1 ? "refeição" : "refeições"}`;

    const shoppingItems = calculateShoppingList(
      plan,
      recipeData.receitas,
      ingredientData.ingredientes,
      conversionData.conversoes,
      ingredientData.categorias || [],
    );
    container.replaceChildren();

    if (shoppingItems.length === 0) {
      const empty = createElement("div", "empty-state");
      empty.append(
        createElement("h2", "", "A lista ainda está vazia"),
        createElement("p", "", "Volte ao planejamento e escolha ao menos uma receita."),
      );
      container.append(empty);
      return;
    }

    const grouped = new Map();
    shoppingItems.forEach((item) => {
      if (!grouped.has(item.categoria)) grouped.set(item.categoria, []);
      grouped.get(item.categoria).push(item);
    });

    [...grouped.entries()]
      .sort(([categoryA], [categoryB]) => categoryRank(categoryA, ingredientData.categorias || []) - categoryRank(categoryB, ingredientData.categorias || []))
      .forEach(([category, items]) => {
        const section = createElement("section", "shopping-category");
        section.append(createElement("h2", "", category));
        const table = createElement("table", "shopping-table");
        const head = document.createElement("thead");
        const headerRow = document.createElement("tr");
        ["Ingrediente", "Quantidade", "Unidade de compra"].forEach((label) => headerRow.append(createElement("th", "", label)));
        head.append(headerRow);
        const body = document.createElement("tbody");
        items.forEach((item) => {
          const row = document.createElement("tr");
          row.append(
            createElement("td", "item-name", displayName(item.nome)),
            createElement("td", "item-quantity", formatQuantity(item.quantidadeCompra)),
            createElement("td", "item-unit", item.unidadeCompra),
          );
          body.append(row);
        });
        table.append(head, body);
        section.append(table);
        container.append(section);
      });
  } catch (error) {
    showError(container, error.message);
  }
}

const page = document.body.dataset.page;
if (page === "planner") initPlanner();
if (page === "recipe") initRecipe();
if (page === "shopping") initShopping();
if (page === "recipe-book") initRecipeBook();