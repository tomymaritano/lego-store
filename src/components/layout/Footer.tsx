"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Truck,
  Shield,
  Heart,
} from "lucide-react";

const footerLinks = {
  shop: {
    title: "Comprar",
    links: [
      { name: "Todos los Sets", href: "/" },
      { name: "Helmets", href: "/category/helmet" },
      { name: "Brickheadz", href: "/category/brickheadz" },
      { name: "Vehículos", href: "/category/cars" },
      { name: "Ofertas", href: "/?sale=true" },
    ],
  },
  themes: {
    title: "Temas",
    links: [
      { name: "Star Wars", href: "/?theme=Star+Wars" },
      { name: "Marvel", href: "/?theme=Marvel" },
      { name: "Disney", href: "/?theme=Disney" },
      { name: "Harry Potter", href: "/?theme=Harry+Potter" },
    ],
  },
  help: {
    title: "Ayuda",
    links: [
      { name: "Preguntas Frecuentes", href: "/faq" },
      { name: "Envíos y Entregas", href: "/shipping" },
      { name: "Devoluciones", href: "/returns" },
      { name: "Contacto", href: "/contact" },
    ],
  },
  about: {
    title: "Nosotros",
    links: [
      { name: "Sobre LEGO Store", href: "/about" },
      { name: "Blog", href: "/blog" },
      { name: "Trabaja con nosotros", href: "/careers" },
      { name: "Prensa", href: "/press" },
    ],
  },
};

const socialLinks = [
  { name: "Facebook", icon: Facebook, href: "#", color: "hover:bg-blue-600" },
  { name: "Twitter", icon: Twitter, href: "#", color: "hover:bg-sky-500" },
  { name: "Instagram", icon: Instagram, href: "#", color: "hover:bg-pink-600" },
  { name: "YouTube", icon: Youtube, href: "#", color: "hover:bg-red-600" },
];

const paymentMethods = [
  "Visa",
  "Mastercard",
  "Amex",
  "PayPal",
];

const features = [
  { icon: Truck, text: "Envío gratis +$5,000" },
  { icon: Shield, text: "Compra segura" },
  { icon: CreditCard, text: "MSI disponibles" },
];

export function Footer() {
  return (
    <footer className="bg-gradient-to-b from-lego-black to-gray-900 text-white mt-auto">
      {/* Features Banner */}
      <div className="border-b border-gray-800">
        <div className="container-custom py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={feature.text}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-center gap-3 py-2"
              >
                <div className="w-10 h-10 rounded-full bg-lego-yellow/10 flex items-center justify-center">
                  <feature.icon className="w-5 h-5 text-lego-yellow" />
                </div>
                <span className="text-sm font-medium text-gray-300">{feature.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="container-custom py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-3 lg:col-span-2">
            {/* Logo */}
            <Link href="/" className="inline-flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-lego-yellow rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-lego-red font-black text-xl">L</span>
              </div>
              <span className="text-2xl font-black">LEGO Store</span>
            </Link>

            <p className="text-gray-400 text-sm leading-relaxed mb-6 max-w-sm">
              Tu tienda favorita de LEGO. Construye mundos increíbles pieza a pieza.
              Productos originales con garantía oficial.
            </p>

            {/* Contact Info */}
            <div className="space-y-3 mb-6">
              <a
                href="mailto:hola@legostore.com"
                className="flex items-center gap-3 text-sm text-gray-400 hover:text-lego-yellow transition-colors"
              >
                <Mail className="w-4 h-4" />
                hola@legostore.com
              </a>
              <a
                href="tel:+525512345678"
                className="flex items-center gap-3 text-sm text-gray-400 hover:text-lego-yellow transition-colors"
              >
                <Phone className="w-4 h-4" />
                +52 55 1234 5678
              </a>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <MapPin className="w-4 h-4" />
                Ciudad de México, México
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-2">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className={`w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center transition-all duration-300 hover:scale-110 ${social.color}`}
                  aria-label={social.name}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          {Object.values(footerLinks).map((section) => (
            <div key={section.title}>
              <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-lego-yellow transition-colors text-sm inline-block hover:translate-x-1 duration-200"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h4 className="font-bold text-lg mb-1">Suscríbete al Newsletter</h4>
              <p className="text-gray-400 text-sm">
                Recibe ofertas exclusivas y novedades directamente en tu correo.
              </p>
            </div>
            <form className="flex gap-2 w-full lg:w-auto">
              <input
                type="email"
                placeholder="tu@email.com"
                className="flex-1 lg:w-64 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-lego-yellow focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-3 bg-lego-yellow text-lego-black font-bold rounded-xl hover:bg-yellow-400 transition-colors whitespace-nowrap"
              >
                Suscribirse
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800 bg-gray-900/50">
        <div className="container-custom py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Copyright */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>© {new Date().getFullYear()} LEGO Store.</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Hecho con</span>
              <Heart className="hidden sm:inline w-4 h-4 text-lego-red fill-lego-red" />
              <span className="hidden sm:inline">para portafolio</span>
            </div>

            {/* Legal Links */}
            <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacidad
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Términos
              </Link>
              <Link href="/cookies" className="hover:text-white transition-colors">
                Cookies
              </Link>
              <Link href="/accessibility" className="hover:text-white transition-colors">
                Accesibilidad
              </Link>
            </div>

            {/* Payment Methods */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-600">Métodos de pago:</span>
              <div className="flex gap-2">
                {paymentMethods.map((method) => (
                  <div
                    key={method}
                    className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 font-medium"
                  >
                    {method}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
