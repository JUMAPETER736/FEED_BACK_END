import { BusinessCatalogue } from "../../../models/apps/business/business.catalogue.model.js";
import { BusinessProduct } from "../../../models/apps/business/business.product.model.js";
import { ApiError } from "../../../utils/ApiError.js";
import { ApiResponse } from "../../../utils/ApiResponse.js";
import { asyncHandler } from "../../../utils/asyncHandler.js";
import { getStaticBusinessProductImagePath } from "../../../utils/helpers.js";
import fs from "fs";
import path from "path";
import { SocialPost } from "../../../models/apps/social-media/post.models.js";

// Get the business catalogue for the requesting user
export const getMyCatalogue = async (req, res) => {
  try {
    const userId = req.user.id;
    const catalogue = await BusinessCatalogue.findOne({ owner: userId }).populate('products');

    if (!catalogue) {
      return res.status(404).json(new ApiError(404, 'Catalogue not found'));
    }

    res.status(200).json(new ApiResponse(200, catalogue, 'Catalogue retrieved successfully'));
  } catch (error) {
    res.status(500).json(new ApiError(500, 'Error retrieving catalogue'));
  }
};

// Get a business catalogue by user ID
export const getCatalogueByUserId = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const catalogue = await BusinessCatalogue.findOne({ owner: userId }).populate(
    {
      path: 'products',
      options: { sort: { createdAt: -1 } } // -1 for descending, 1 for ascending
    }
  );

  if (!catalogue) {
    return res.status(404).json(new ApiError(404, 'Catalogue not found'));
  }

  res.status(200).json(new ApiResponse(200, catalogue, 'Catalogue retrieved successfully'));
});

// Add a product to the catalogue
export const addProductToCatalogue = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemName, description, features, price, category } = req.body;

    // Extract image files from the request
    const images = req.files.map((file) => {
      var path = getStaticBusinessProductImagePath(req, file.filename)
      console.log("Image path", path);
      return path;
    }); // Assuming multer is configured to store file paths

    // console.log("Item Name: ", itemName);
    // console.log("Description: ", description);
    // console.log("Features: ", features);
    // console.log("add product images size ", images);

    // Find or create the business catalogue for the user
    let businessCatalogue = await BusinessCatalogue.findOne({ owner: userId });
    if (!businessCatalogue) {
      // Create the business catalogue and associate it with the business profile

      console.log("business catalogue not found");
      businessCatalogue = new BusinessCatalogue({
        owner: userId,
        businessProfile: business._id,
        products: [],
      });

      businessCatalogue.save();
    }

    // console.log("creating business product catalogue id: ", businessCatalogue._id);
    // Create the product and associate it with the catalogue
    const product = new BusinessProduct({
      owner: userId,
      catalogue: businessCatalogue._id,
      itemName: itemName,
      description: description,
      features: features,
      images,
      price,
      category
    });


    await product.save();

    // console.log("business product created");

    // Update the catalogue to include the new product
    businessCatalogue.products.push(product._id);
    await businessCatalogue.save();
  
    const businessPost = await SocialPost.create({
      feedShortsBusinessId: product._id,
      author: product.owner
    });

    console.log("BusinessPost", businessPost);


    res.status(201).json(new ApiResponse(201, product, 'Product added to catalogue successfully'));
  } catch (error) {
    res.status(500).json(new ApiError(500, 'Error adding product to catalogue'));
  }
};


// Get Products from my catalogue
export const getMycatalogueProducts = async (req, res) => {
  try {

    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const businessCatalogue = await BusinessCatalogue.findOne({ owner: userId }).sort({ createdAt: -1 })
      .populate({
        path: 'products',
        options: {
          limit,
          skip,
          sort: { createdAt: -1 },
        },
      });

    if (!businessCatalogue) {
      return res.status(404).json(new ApiError(404, 'Business catalogue not found'));
    }

    console.log("Catalogue Products Retrieved")

    const products = businessCatalogue.products;

    res.status(200).json(new ApiResponse(200, products, 'Your Products retrieved successfully'));
  } catch (error) {
    res.status(500).json(new ApiError(500, 'Error retrieving your products'));
  }
}


// Get all products in a catalogue with pagination
export const getProductsInCatalogue = async (req, res) => {
  try {
    const { catalogueId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const businessCatalogue = await BusinessCatalogue.findById(catalogueId).sort({ createdAt: 'ascending' })
      .populate({
        path: 'products',
        options: {
          limit,
          skip,
        },
      });

    console.log("Catalog Products Retrieved")

    if (!businessCatalogue) {
      return res.status(404).json(new ApiError(404, 'Business catalogue not found'));
    }

    const products = businessCatalogue.products;

    res.status(200).json(new ApiResponse(200, products, 'Products retrieved successfully'));
  } catch (error) {
    res.status(500).json(new ApiError(500, 'Error retrieving products'));
  }
};


// Delete a product from the catalogue
export const deleteProductFromCatalogue = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = req.params.productId;

    // Find the product to ensure it belongs to the user
    const product = await BusinessProduct.findOne({ _id: productId, owner: userId });
    if (!product) {
      return res.status(404).json(new ApiError(404, 'Product not found or you do not have permission to delete this product'));
    }

    // Remove the product
    await BusinessProduct.deleteOne({ _id: productId });

    // Remove the reference from the catalogue
    await BusinessCatalogue.findOneAndUpdate(
      { owner: userId },
      { $pull: { products: productId } }
    );

    return res.status(200).json(new ApiResponse(200, null, 'Product deleted successfully'));
  } catch (error) {
    res.status(500).json(new ApiError(500, 'Error deleting product'));
  }
};


const deleteProductImages = (images) => {
  images.forEach((imagePath) => {
    try {
      const filename = imagePath.split('/').pop();

      const filePath = path.join(process.cwd(), 'public', 'business', 'products', filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('Deleted old image:', filename);
      }
    } catch (err) {
      console.error('Error deleting image:', err);
    }
  });
};


export const updateProductInCatalogue = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;
    const { itemName, description, features, price, replaceImages, existingImages } = req.body;
    
    const existingProduct = await BusinessProduct.findById(productId);
    
    if (!existingProduct) {
      return res.status(404).json(new ApiError(404, 'Product not found'));
    }
    
    if (existingProduct.owner.toString() !== userId) {
      return res.status(403).json(new ApiError(403, 'Unauthorized to update this product'));
    }
    
    const updateData = {};
    if (itemName) updateData.itemName = itemName;
    if (description) updateData.description = description;
    if (features) updateData.features = features;
    if (price) updateData.price = price;
    
    // Parse existingImages from JSON string
    let keptImages = [];
    if (existingImages) {
      try {
        keptImages = JSON.parse(existingImages);
      } catch (e) {
        console.error('Error parsing existingImages:', e);
        keptImages = [];
      }
    }
    
    // Find images that were removed (exist in DB but not in keptImages)
    const removedImages = existingProduct.images.filter(
      img => !keptImages.includes(img)
    );
    
    // Delete removed images from filesystem
    if (removedImages.length > 0) {
      console.log('Deleting removed images:', removedImages);
      deleteProductImages(removedImages);
    }
    
    // Handle new image uploads
    const newImages = req.files && req.files.length > 0 
      ? req.files.map((file) => getStaticBusinessProductImagePath(req, file.filename))
      : [];
    
    // Parse replaceImages as boolean
    const shouldReplace = replaceImages === 'true' || replaceImages === true;
    
    if (shouldReplace && newImages.length > 0) {
      // SCENARIO 1: Replace - delete all old images and use only new ones
      console.log('Replacing all images with new ones');
      deleteProductImages(existingProduct.images);
      updateData.images = newImages;
    } else {
      // SCENARIO 2: Keep existing (minus removed) and add new ones
      console.log('Keeping existing images and adding new ones');
      updateData.images = [...keptImages, ...newImages];
    }
    
    const updatedProduct = await BusinessProduct.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.status(200).json(
      new ApiResponse(200, updatedProduct, 'Product updated successfully')
    );
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json(new ApiError(500, 'Error updating product'));
  }
});