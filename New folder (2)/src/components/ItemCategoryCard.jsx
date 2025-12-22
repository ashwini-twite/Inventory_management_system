export default function ItemCategoryCard({ title, description, image, onClick }) {
  return (
    <div className="category-card" onClick={onClick}>
      <img src={image} className="category-image" alt={title} />
      <h3 className="category-title">{title}</h3>
      <p className="category-description">{description}</p>
    </div>
  );
}
