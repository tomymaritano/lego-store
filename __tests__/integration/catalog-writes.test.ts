import { beforeEach, describe, expect, it } from "vitest";
import { getPaginatedProducts, getProductById, getCategories, searchProducts } from "@/lib/api";
import { productSearchColumns } from "@/lib/api/search";
import { refreshProductRatings } from "@/lib/api/ratings";
import { resetAndSeed, testDb } from "./setup/db";

/* lib/api reads after writes: every test starts from a freshly seeded database. */

beforeEach(async () => {
  await resetAndSeed();
});

describe("lib/api after catalogue writes", () => {
  it("puts products without reviews last in Destacados and in the rating sort", async () => {
    await testDb.review.deleteMany({ where: { productId: "1" } });
    await refreshProductRatings(testDb, ["1"]);

    const featured = (await getPaginatedProducts({ limit: 48 })).items;
    expect(featured.at(-1)?.id).toBe("1");
    expect(featured[0].id).toBe("2");
    expect((await getProductById("1"))).toMatchObject({ rating: 0, reviewCount: 0 });
    expect((await getPaginatedProducts({ sort: "rating", limit: 48 })).items.at(-1)?.id).toBe("1");
  });

  it("finds a new product by its stored search columns and counts it in its category", async () => {
    await testDb.product.create({
      data: {
        name: "Camión de Bomberos",
        price: 1500,
        categoryId: "cars",
        type: "Sets",
        age: "12+",
        themeId: (await testDb.theme.upsert({ where: { name: "City" }, create: { name: "City", slug: "city", position: 99 }, update: {} })).id,
        interests: ["Vehículos"],
        pieces: "0-500",
        highlight: "Destacados",
        img: "/images/placeholder-product.svg",
        images: ["/images/placeholder-product.svg"],
        stock: 3,
        shortDescription: "Con escalera extensible.",
        description: "Un camión con escalera extensible.",
        ...productSearchColumns({
          name: "Camión de Bomberos",
          theme: "City",
          categoryId: "cars",
          categoryName: "Vehículos",
          description: "Un camión con escalera extensible.",
        }),
      },
    });

    expect((await searchProducts("camion bomberos")).map((p) => p.name)).toEqual(["Camión de Bomberos"]);
    expect((await searchProducts("vehiculos city")).map((p) => p.name)).toContain("Camión de Bomberos");
    const cars = (await getCategories()).find((c) => c.id === "cars")!;
    expect(cars.productCount).toBe(await testDb.product.count({ where: { categoryId: "cars" } }));
    // Newest first: no isNew flag, but the most recently created of the old ones.
    const newest = (await getPaginatedProducts({ sort: "newest", limit: 48 })).items;
    const firstOld = newest.findIndex((p) => !p.isNew);
    expect(newest[firstOld].name).toBe("Camión de Bomberos");
  });

  it("reflects stock changes in the in-stock filter", async () => {
    const before = (await getPaginatedProducts({ inStock: true, limit: 48 })).total;
    await testDb.product.update({ where: { id: "15" }, data: { stock: 0 } });
    expect((await getPaginatedProducts({ inStock: true, limit: 48 })).total).toBe(before - 1);
  });
});
