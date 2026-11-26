"use client";

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { MenuItem } from "@/types/restaurant";
import { 
  fetchMenuItems, 
  updateMenuItem, 
  createMenuItem 
} from "@/lib/api/menu";
import { 
  Plus, 
  Search, 
  Edit, 
  Check, 
  ToggleLeft, 
  ToggleRight, 
  AlertCircle, 
  Filter, 
  DollarSign, 
  RefreshCw, 
  Star, 
  Package, 
  Trash2, 
  Image as ImageIcon 
} from "lucide-react";
import {
  fetchIngredients,
  fetchDishRecipes,
  linkRecipeIngredient,
  unlinkRecipeIngredient,
  IngredientStock,
  DishRecipeItem
} from "@/lib/api/inventory";

export default function MenuManagementPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editItemModal, setEditItemModal] = useState<MenuItem | null>(null);
  const [showNewModal, setShowNewModal] = useState<boolean>(false);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "starters",
    price: 250,
    description: "",
    dietary: "veg",
    station: "kitchen",
    photo_url: "",
    preparation_time_minutes: 15,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Recipe BOM Modal State
  const [recipeModalDish, setRecipeModalDish] = useState<MenuItem | null>(null);
  const [dishRecipes, setDishRecipes] = useState<DishRecipeItem[]>([]);
  const [allIngredients, setAllIngredients] = useState<IngredientStock[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>("");
  const [recipeQuantity, setRecipeQuantity] = useState<string>("0.100");
  const [isLinkingRecipe, setIsLinkingRecipe] = useState<boolean>(false);

  const openRecipeModal = async (dish: MenuItem) => {
    setRecipeModalDish(dish);
    try {
      const [recs, ings] = await Promise.all([
        fetchDishRecipes(dish.id).catch(() => []),
        fetchIngredients().catch(() => []),
      ]);
      setDishRecipes(recs);
      setAllIngredients(ings);
      if (ings.length > 0) {
        setSelectedIngredientId(ings[0].id);
      }
    } catch {
      showToast("Error loading recipe data");
    }
  };

  const handleLinkIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipeModalDish || !selectedIngredientId) return;
    const qty = parseFloat(recipeQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast("Quantity must be greater than zero");
      return;
    }
    setIsLinkingRecipe(true);
    try {
      await linkRecipeIngredient(recipeModalDish.id, selectedIngredientId, qty);
      showToast("Raw ingredient linked to recipe!");
      const updated = await fetchDishRecipes(recipeModalDish.id);
      setDishRecipes(updated);
      setRecipeQuantity("0.100");
    } catch (err: any) {
      showToast(err.message || "Failed to link ingredient");
    } finally {
      setIsLinkingRecipe(false);
    }
  };

  const handleUnlinkIngredient = async (recipeItemId: string) => {
    if (!recipeModalDish) return;
    try {
      await unlinkRecipeIngredient(recipeItemId);
      showToast("Recipe link removed");
      const updated = await fetchDishRecipes(recipeModalDish.id);
      setDishRecipes(updated);
    } catch (err: any) {
      showToast(err.message || "Failed to remove recipe link");
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadRemoteMenu = async () => {
    try {
      setLoading(true);
      const data = await fetchMenuItems();
      if (Array.isArray(data)) setItems(data);
    } catch (err: any) {
      showToast(err.message || "Failed to load menu items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRemoteMenu();
  }, []);

  const toggleStock = async (dishId: string) => {
    const item = items.find((i) => i.id === dishId);
    if (!item) return;
    const next = !item.inStock;
    setItems((prev) =>
      prev.map((it) => (it.id === dishId ? { ...it, inStock: next } : it))
    );
    showToast(`${item.name} is now marked ${next ? "IN STOCK" : "OUT OF STOCK"}`);
    try {
      await updateMenuItem(dishId, { inStock: next });
    } catch {
      // keep local update
    }
  };

  const toggleBestseller = async (dishId: string) => {
    const item = items.find((i) => i.id === dishId);
    if (!item) return;
    const next = !item.bestseller;
    setItems((prev) =>
      prev.map((it) => (it.id === dishId ? { ...it, bestseller: next } : it))
    );
    showToast(`${item.name} ${next ? "marked as Chef's Pick ⭐" : "removed from Chef's Pick"}`);
    try {
      await updateMenuItem(dishId, { bestseller: next });
    } catch {
      // keep local update
    }
  };

  const handleSavePrice = async (dishId: string, newPrice: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === dishId ? { ...it, price: newPrice } : it))
    );
    showToast("Menu pricing updated successfully");
    setEditItemModal(null);
    try {
      await updateMenuItem(dishId, { price: newPrice });
    } catch {
      // keep local update
    }
  };

  const handleCreateMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name) return;
    try {
      const created = await createMenuItem({
        name: newItem.name,
        category: newItem.category,
        price: Number(newItem.price),
        description: newItem.description,
        dietary: newItem.dietary,
        station: newItem.station,
        photo_url: newItem.photo_url || undefined,
        preparation_time_minutes: Number(newItem.preparation_time_minutes),
      });
      setItems((prev) => [created, ...prev]);
      showToast(`Added ${created.name} to restaurant menu catalog`);
      setShowNewModal(false);
      setNewItem({
        name: "",
        category: "starters",
        price: 250,
        description: "",
        dietary: "veg",
        station: "kitchen",
        photo_url: "",
        preparation_time_minutes: 15,
      });
    } catch (err: any) {
      showToast(err.message || "Failed to create menu dish");
    }
  };

  const filteredItems = items.filter((it) => {
    if (selectedCategory !== "all" && it.category !== selectedCategory) return false;
    if (
      searchQuery &&
      !it.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !it.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        category="Catalog & Recipes"
        title="Menu & Pricing Management"
        subtitle="Configure dish pricing, variants, station routing, and toggle 86'd items in real time across POS, QR and Kiosks."
        actions={
          <div className="flex items-center gap-3">
            <button
              onClick={loadRemoteMenu}
              disabled={loading}
              className="px-3.5 py-2 border border-stone-800 bg-[#181514] hover:bg-stone-800 text-xs font-mono text-stone-200 flex items-center gap-2 rounded-xl transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#E07A5F] ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Menu Item</span>
            </button>
          </div>
        }
      />

      {/* Category Pills & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[#181514] border border-stone-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {["all", "starters", "mains", "breads", "beverages", "desserts"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? "bg-[#E07A5F]/20 text-[#F4A261] border border-[#E07A5F]/40"
                  : "text-stone-400 hover:text-white hover:bg-stone-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search dish or recipe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:border-[#E07A5F]"
          />
        </div>
      </div>

      {/* Menu Table / Cards */}
      <div className="rounded-2xl bg-[#181514] border border-stone-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#151211] border-b border-stone-800 text-stone-400 font-mono uppercase text-[10px]">
              <tr>
                <th className="px-5 py-3.5">Dish Details</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Station</th>
                <th className="px-4 py-3.5">Selling Price</th>
                <th className="px-4 py-3.5">Live Stock Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/80">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-stone-500 font-mono">
                    Loading menu catalog from PostgreSQL...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-stone-500 font-mono">
                    No dishes found in category "{selectedCategory}".
                  </td>
                </tr>
              ) : (
                filteredItems.map((dish) => (
                  <tr key={dish.id} className="hover:bg-stone-900/40 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                            dish.dietary === "veg" ? "border-emerald-500" : "border-rose-500"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              dish.dietary === "veg" ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs">{dish.name}</span>
                            <button
                              type="button"
                              onClick={() => toggleBestseller(dish.id)}
                              className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                                dish.bestseller
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 font-semibold"
                                  : "bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300"
                              }`}
                              title={dish.bestseller ? "Click to remove Chef's Pick" : "Click to set as Chef's Pick"}
                            >
                              <Star className={`w-2.5 h-2.5 ${dish.bestseller ? "fill-amber-400 text-amber-400" : ""}`} />
                              <span>{dish.bestseller ? "Chef's Pick" : "Set Chef's Pick"}</span>
                            </button>
                          </div>
                          <p className="text-[11px] text-stone-400 line-clamp-1 mt-0.5">
                            {dish.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 capitalize text-stone-300 font-medium">
                      {dish.category}
                    </td>
                    <td className="px-4 py-4 font-mono text-[11px] text-stone-400 capitalize">
                      {dish.station}
                    </td>
                    <td className="px-4 py-4 font-bold text-emerald-400 text-xs">
                      ₹{dish.price}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => toggleStock(dish.id)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                          dish.inStock
                            ? "bg-emerald-950/80 text-emerald-400 border-emerald-500/40 hover:bg-rose-950/60 hover:text-rose-400 hover:border-rose-500/40"
                            : "bg-rose-950/80 text-rose-400 border-rose-500/40 hover:bg-emerald-950/60 hover:text-emerald-400 hover:border-emerald-500/40"
                        }`}
                        title="Click to toggle stock availability"
                      >
                        <span className={`w-2 h-2 rounded-full ${dish.inStock ? "bg-emerald-400" : "bg-rose-400"}`} />
                        <span>{dish.inStock ? "Available" : "Out of Stock"}</span>
                      </button>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openRecipeModal(dish)}
                          className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-stone-800 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                          title="Connect Raw Materials (Recipe BOM)"
                        >
                          <Package className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditItemModal(dish)}
                          className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white transition-colors cursor-pointer"
                          title="Edit Dish Pricing"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Price Modal */}
      {editItemModal && (
        <Modal
          isOpen={!!editItemModal}
          onClose={() => setEditItemModal(null)}
          title={`Edit Menu Item: ${editItemModal.name}`}
          description="Update pricing and station routing"
          maxWidth="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1.5">
                Selling Price (₹ INR)
              </label>
              <input
                type="number"
                defaultValue={editItemModal.price}
                id="edit-price-input"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                onClick={() => setEditItemModal(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById("edit-price-input") as HTMLInputElement;
                  if (input) handleSavePrice(editItemModal.id, Number(input.value));
                }}
                className="px-4 py-2 rounded-xl bg-[#E07A5F] text-stone-950 font-bold text-xs cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Add New Menu Item Modal */}
      <Modal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        title="Add New Dish to Catalog"
        description="Configure recipe, selling price, and station routing in PostgreSQL"
        maxWidth="md"
      >
        <form onSubmit={handleCreateMenuItem} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Dish Name *</label>
              <input
                type="text"
                required
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g. Mutton Rogan Josh"
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Selling Price (₹) *</label>
              <input
                type="number"
                step="5"
                required
                value={newItem.price}
                onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Category</label>
              <select
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs"
              >
                <option value="starters">Starters</option>
                <option value="mains">Mains</option>
                <option value="breads">Breads</option>
                <option value="beverages">Beverages</option>
                <option value="desserts">Desserts</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Dietary Type</label>
              <select
                value={newItem.dietary}
                onChange={(e) => setNewItem({ ...newItem, dietary: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs"
              >
                <option value="veg">Vegetarian</option>
                <option value="nonveg">Non-Vegetarian</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Kitchen Station</label>
              <select
                value={newItem.station}
                onChange={(e) => setNewItem({ ...newItem, station: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs"
              >
                <option value="curry">Curry / Gravy</option>
                <option value="tandoor">Tandoor</option>
                <option value="bar">Bar / Mocktail</option>
                <option value="pantry">Pantry / Desserts</option>
                <option value="kitchen">General Kitchen</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">Dish Description</label>
            <input
              type="text"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              placeholder="e.g. Slow-cooked Kashmiri tender mutton chunks in aromatic saffron gravy"
              className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Photo URL (Optional)</label>
              <input
                type="url"
                value={newItem.photo_url}
                onChange={(e) => setNewItem({ ...newItem, photo_url: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1">Prep Time (Minutes)</label>
              <input
                type="number"
                value={newItem.preparation_time_minutes}
                onChange={(e) => setNewItem({ ...newItem, preparation_time_minutes: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-white text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-800">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#E07A5F] text-stone-950 font-bold text-xs cursor-pointer hover:bg-[#d0694e]"
            >
              Add Dish to Menu
            </button>
          </div>
        </form>
      </Modal>

      {/* Recipe (BOM) Management Modal */}
      {recipeModalDish && (
        <Modal
          isOpen={Boolean(recipeModalDish)}
          onClose={() => setRecipeModalDish(null)}
          title={`Recipe & Raw Material Mapping: ${recipeModalDish.name}`}
          description="Map raw inventory ingredients to auto-deduct stock upon kitchen KOT transmission"
          maxWidth="lg"
        >
          <div className="space-y-5">
            {/* Connected Ingredients List */}
            <div>
              <h4 className="text-xs font-semibold uppercase font-mono tracking-wider text-stone-400 mb-2">
                Connected Raw Materials ({dishRecipes.length})
              </h4>
              {dishRecipes.length === 0 ? (
                <div className="p-4 rounded-xl bg-stone-900/60 border border-dashed border-stone-800 text-center text-xs text-stone-400">
                  No raw materials linked yet. Connect ingredients below to enable auto-deduction.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {dishRecipes.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-stone-900 border border-stone-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-semibold text-white">{r.ingredient_name}</span>
                        <span className="text-stone-400 font-mono">
                          ({r.quantity_required} {r.unit} / serving)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnlinkIngredient(r.id)}
                        className="p-1 rounded-lg hover:bg-rose-950/60 text-stone-500 hover:text-rose-400 transition-colors"
                        title="Remove ingredient link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Link New Raw Material Form */}
            <form onSubmit={handleLinkIngredient} className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 space-y-3">
              <h5 className="text-xs font-semibold text-stone-300">Link Raw Material to Dish</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Select Ingredient</label>
                  <select
                    value={selectedIngredientId}
                    onChange={(e) => setSelectedIngredientId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-white text-xs focus:outline-none focus:border-[#E07A5F]"
                  >
                    {allIngredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.unit}) — Available: {ing.current_stock}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-stone-400 mb-1">Quantity per Serving</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={recipeQuantity}
                    onChange={(e) => setRecipeQuantity(e.target.value)}
                    placeholder="e.g. 0.200"
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-700 text-white text-xs font-mono focus:outline-none focus:border-[#E07A5F]"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isLinkingRecipe || allIngredients.length === 0}
                  className="px-4 py-2 rounded-xl bg-[#E07A5F] hover:bg-[#d0694e] text-stone-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isLinkingRecipe ? "Linking..." : "Connect Raw Material"}</span>
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Floating toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-stone-900 border border-emerald-500/40 text-emerald-300 text-xs shadow-2xl backdrop-blur-md">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
