import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "./cutoff";

interface OrderItem { name: string; qty: number; price: number }
export interface InvoiceOrder {
  id: string;
  delivery_date: string;
  meal_type: string;
  items: OrderItem[];
  total_amount: number | string;
  status: string;
  payment_method: string;
  delivery_address: string;
  phone: string;
  created_at: string;
}

const BRAND = "Family Food Service";
const TAGLINE = "Home-style daily meals";

function header(doc: jsPDF, title: string, subtitle?: string) {
  doc.setFillColor(234, 88, 12); // saffron
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(BRAND, 14, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(TAGLINE, 14, 19);
  doc.setFontSize(11);
  doc.text(title, doc.internal.pageSize.getWidth() - 14, 13, { align: "right" });
  if (subtitle) doc.text(subtitle, doc.internal.pageSize.getWidth() - 14, 19, { align: "right" });
  doc.setTextColor(20, 20, 20);
}

function footer(doc: jsPDF) {
  const h = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Thank you for ordering with Family Food Service.", 14, h - 10);
  doc.text(`Generated ${new Date().toLocaleString("en-IN")}`, doc.internal.pageSize.getWidth() - 14, h - 10, { align: "right" });
}

export function downloadOrderInvoice(order: InvoiceOrder) {
  const doc = new jsPDF();
  header(doc, "INVOICE", `#${order.id.slice(0, 8).toUpperCase()}`);

  let y = 38;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Bill to", 14, y);
  doc.text("Delivery", 110, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  const addrLines = doc.splitTextToSize(order.delivery_address, 85);
  doc.text(addrLines, 14, y);
  doc.text(order.phone, 14, y + addrLines.length * 5);

  doc.text(`Date: ${formatDate(order.delivery_date)}`, 110, y);
  doc.text(`Meal: ${order.meal_type}`, 110, y + 5);
  doc.text(`Status: ${order.status.replace(/_/g, " ")}`, 110, y + 10);
  doc.text(`Payment: ${order.payment_method.toUpperCase()}`, 110, y + 15);

  autoTable(doc, {
    startY: y + Math.max(addrLines.length * 5 + 12, 25),
    head: [["Item", "Qty", "Price", "Subtotal"]],
    body: order.items.map((it) => [
      it.name,
      String(it.qty),
      `Rs. ${it.price.toLocaleString("en-IN")}`,
      `Rs. ${(it.price * it.qty).toLocaleString("en-IN")}`,
    ]),
    headStyles: { fillColor: [234, 88, 12], textColor: 255 },
    styles: { fontSize: 10 },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });

  // @ts-expect-error autotable adds lastAutoTable
  const finalY = doc.lastAutoTable?.finalY ?? y + 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total", 140, finalY + 12);
  doc.text(`Rs. ${Number(order.total_amount).toLocaleString("en-IN")}`, 196, finalY + 12, { align: "right" });

  footer(doc);
  doc.save(`invoice-${order.id.slice(0, 8)}.pdf`);
}

export function downloadSummary(orders: InvoiceOrder[], range: { label: string; from: string; to: string }) {
  const doc = new jsPDF();
  header(doc, range.label, `${range.from} to ${range.to}`);

  const total = orders.reduce((s, o) => s + Number(o.total_amount), 0);

  autoTable(doc, {
    startY: 38,
    head: [["Date", "Meal", "Order #", "Items", "Payment", "Status", "Total"]],
    body: orders.map((o) => [
      formatDate(o.delivery_date),
      o.meal_type,
      o.id.slice(0, 8).toUpperCase(),
      o.items.reduce((s, i) => s + i.qty, 0).toString(),
      o.payment_method.toUpperCase(),
      o.status.replace(/_/g, " "),
      `Rs. ${Number(o.total_amount).toLocaleString("en-IN")}`,
    ]),
    headStyles: { fillColor: [234, 88, 12], textColor: 255 },
    styles: { fontSize: 9 },
    columnStyles: { 6: { halign: "right" } },
  });

  // @ts-expect-error autotable adds lastAutoTable
  const finalY = doc.lastAutoTable?.finalY ?? 60;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Orders: ${orders.length}`, 14, finalY + 12);
  doc.text(`Grand Total: Rs. ${total.toLocaleString("en-IN")}`, 196, finalY + 12, { align: "right" });

  footer(doc);
  doc.save(`${range.label.toLowerCase().replace(/\s+/g, "-")}-${range.from}.pdf`);
}
