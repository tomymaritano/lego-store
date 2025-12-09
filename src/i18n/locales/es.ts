export const es = {
  common: {
    search: "Buscar",
    cart: "Carrito",
    wishlist: "Lista de deseos",
    home: "Inicio",
    products: "Productos",
    compare: "Comparar",
    loading: "Cargando...",
    error: "Error",
    retry: "Reintentar",
    close: "Cerrar",
    back: "Volver",
    next: "Siguiente",
    previous: "Anterior",
    save: "Guardar",
    cancel: "Cancelar",
    delete: "Eliminar",
    edit: "Editar",
    add: "Agregar",
    remove: "Eliminar",
    seeAll: "Ver todo",
    seeMore: "Ver más",
    noResults: "Sin resultados",
  },
  nav: {
    home: "Inicio",
    search: "Buscar",
    cart: "Carrito",
    wishlist: "Favoritos",
    account: "Mi cuenta",
  },
  product: {
    addToCart: "Agregar al carrito",
    addedToCart: "Agregado al carrito",
    addToWishlist: "Agregar a favoritos",
    removeFromWishlist: "Quitar de favoritos",
    inStock: "En stock",
    outOfStock: "Agotado",
    pieces: "piezas",
    age: "Edad",
    theme: "Tema",
    rating: "Calificación",
    reviews: "reseñas",
    description: "Descripción",
    specifications: "Especificaciones",
    relatedProducts: "Productos relacionados",
    new: "Nuevo",
    sale: "Oferta",
    exclusive: "Exclusivo",
  },
  cart: {
    title: "Tu carrito",
    empty: "Tu carrito está vacío",
    emptyDescription: "Agrega productos para comenzar",
    continueShopping: "Continuar comprando",
    subtotal: "Subtotal",
    shipping: "Envío",
    freeShipping: "GRATIS",
    total: "Total",
    checkout: "Finalizar compra",
    remove: "Eliminar",
    quantity: "Cantidad",
  },
  checkout: {
    title: "Checkout",
    shipping: "Información de envío",
    payment: "Información de pago",
    review: "Revisar pedido",
    confirmation: "Confirmación",
    firstName: "Nombre",
    lastName: "Apellido",
    email: "Email",
    phone: "Teléfono",
    address: "Dirección",
    city: "Ciudad",
    state: "Estado",
    zipCode: "Código postal",
    country: "País",
    cardNumber: "Número de tarjeta",
    cardName: "Nombre en la tarjeta",
    expiryDate: "Fecha de expiración",
    cvv: "CVV",
    placeOrder: "Confirmar pedido",
    processing: "Procesando...",
    orderConfirmed: "¡Pedido confirmado!",
    orderNumber: "Número de pedido",
    thankYou: "Gracias por tu compra",
    continueShopping: "Continuar comprando",
    backToCart: "Volver al carrito",
  },
  search: {
    placeholder: "Buscar productos...",
    results: "resultados",
    noResults: "No se encontraron productos",
    tryDifferent: "Intenta con otro término de búsqueda",
  },
  filters: {
    title: "Filtros",
    clear: "Limpiar filtros",
    apply: "Aplicar",
    price: "Precio",
    category: "Categoría",
    theme: "Tema",
    age: "Edad",
    pieces: "Piezas",
    sortBy: "Ordenar por",
    priceAsc: "Precio: menor a mayor",
    priceDesc: "Precio: mayor a menor",
    nameAsc: "Nombre: A-Z",
    nameDesc: "Nombre: Z-A",
  },
  footer: {
    aboutUs: "Sobre nosotros",
    contact: "Contacto",
    help: "Ayuda",
    terms: "Términos y condiciones",
    privacy: "Privacidad",
    shipping: "Envíos",
    returns: "Devoluciones",
    faq: "Preguntas frecuentes",
    followUs: "Síguenos",
    newsletter: "Newsletter",
    subscribe: "Suscribirse",
    emailPlaceholder: "Tu email",
    rights: "Todos los derechos reservados",
  },
  errors: {
    generic: "Algo salió mal",
    notFound: "Página no encontrada",
    notFoundDescription: "La página que buscas no existe",
    goHome: "Ir al inicio",
  },
} as const;

export interface Translations {
  common: {
    search: string;
    cart: string;
    wishlist: string;
    home: string;
    products: string;
    compare: string;
    loading: string;
    error: string;
    retry: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    remove: string;
    seeAll: string;
    seeMore: string;
    noResults: string;
  };
  nav: {
    home: string;
    search: string;
    cart: string;
    wishlist: string;
    account: string;
  };
  product: {
    addToCart: string;
    addedToCart: string;
    addToWishlist: string;
    removeFromWishlist: string;
    inStock: string;
    outOfStock: string;
    pieces: string;
    age: string;
    theme: string;
    rating: string;
    reviews: string;
    description: string;
    specifications: string;
    relatedProducts: string;
    new: string;
    sale: string;
    exclusive: string;
  };
  cart: {
    title: string;
    empty: string;
    emptyDescription: string;
    continueShopping: string;
    subtotal: string;
    shipping: string;
    freeShipping: string;
    total: string;
    checkout: string;
    remove: string;
    quantity: string;
  };
  checkout: {
    title: string;
    shipping: string;
    payment: string;
    review: string;
    confirmation: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    cardNumber: string;
    cardName: string;
    expiryDate: string;
    cvv: string;
    placeOrder: string;
    processing: string;
    orderConfirmed: string;
    orderNumber: string;
    thankYou: string;
    continueShopping: string;
    backToCart: string;
  };
  search: {
    placeholder: string;
    results: string;
    noResults: string;
    tryDifferent: string;
  };
  filters: {
    title: string;
    clear: string;
    apply: string;
    price: string;
    category: string;
    theme: string;
    age: string;
    pieces: string;
    sortBy: string;
    priceAsc: string;
    priceDesc: string;
    nameAsc: string;
    nameDesc: string;
  };
  footer: {
    aboutUs: string;
    contact: string;
    help: string;
    terms: string;
    privacy: string;
    shipping: string;
    returns: string;
    faq: string;
    followUs: string;
    newsletter: string;
    subscribe: string;
    emailPlaceholder: string;
    rights: string;
  };
  errors: {
    generic: string;
    notFound: string;
    notFoundDescription: string;
    goHome: string;
  };
}
