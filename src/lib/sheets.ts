// الدالة دي هتكلم الـ Backend الخاص بيك اللي متأمن بالـ Service Account
export async function fetchGoogleFolderData(folderId: string) {
  try {
    // افترضنا إن الباك اند شغال على بورت 3001
    const response = await fetch(`http://localhost:3001/api/folder-data/${folderId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch data from backend');
    }

    const result = await response.json();
    if (result.success) {
      return result.data; // دي الداتا المدمجة من كل الشيتات
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error in fetchGoogleFolderData:', error);
    throw error;
  }
}
