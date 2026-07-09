export const downloadImage = (imageUrl: string, fileName: string): void => {
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = fileName;
  link.click();
};
