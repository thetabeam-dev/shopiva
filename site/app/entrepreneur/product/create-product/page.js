"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { useRouter, useSearchParams } from 'next/navigation'

import Title from '../../../../components/entrepreneur/product/Title/Title'
import SaveBtn from "../../../../components/entrepreneur/product/Save/SaveBtn"
import SubmissionFinaleModal from "../../../../components/entrepreneur/product/SubmissionFinale/Modal"
import FillFormHintModal from "../../../../components/entrepreneur/product/SubmissionFinale/FillFormHintModal"
import Image from '../../../../components/entrepreneur/product/ImgSample/Image'
import Description from '../../../../components/entrepreneur/product/Description/Description'
import Price from '../../../../components/entrepreneur/product/Price/Price'
import Attribute from '../../../../components/entrepreneur/product/Attributes/Attributes'
import Inventory from '../../../../components/entrepreneur/product/Inventory/Inventory'
import Shipping from '../../../../components/entrepreneur/product/Shipping/Shipping'
import Variant from '../../../../components/entrepreneur/product/Variant/Variant'
import axios from 'axios'
import './styles/xxl.css'
import './styles/s.css'
import categories_json from "../../../../json/mvp_category.json";
import CategoryFloater from '../../../../components/floaters.js/Category'
import VariantFloater from 'components/floaters.js/Variants'
import Select from 'react-select'
import { getShopsByOwner, getProduct, createProduct, createInventory, updateProduct, updateInventory } from '../../../../lib/productApi'

const API_PROXY = "/api/backend";

/** Inline Variant UI (vs floater) from this viewport width up */
const VARIANT_INLINE_MIN_WIDTH = 1200;
const MOBILE_MAX_WIDTH = 480;

export default function CreateProduct() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get("edit")
  const shopFromQuery = searchParams.get("shop")
  const entrepreneur_id = useSelector((s) => s.entrepreneur_id?.entrepreneur_id)
  const [loadedInventoryId, setLoadedInventoryId] = useState(null)
  /** Previous API `specifications` (merge on save; extras are preserved) */
  const [loadedSpecifications, setLoadedSpecifications] = useState({})
  const [editLoading, setEditLoading] = useState(!!editId)



  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [tags, setTags] = useState([]);
  const [price, setPrice] = useState("");
  const [brand, setBrand] = useState("");
  const [deliveryMethods, setdeliveryMethods] = useState({
    pickup: false,
    delivery: false
  });
  const [variant, setVariant] = useState([]);
  const [gender, setGender] = useState("");
  const [category, setCategory] = useState("");
  const [shipping, setShipping] = useState("");
  const [inventory, setInventory] = useState({
    qty: "",
    allow_backorders: false,
  });

  const [categories, setCategories] = useState([]);
  const [typeList, setTypeList] = useState([]);
  const [tagList, setTagList] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [subCategory, setSubCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [errors, setErrors] = useState({});
  const [screenWidth, setScreenWidth] = useState(0);
  const isMountedRef = useRef(true);
  const hasVariants = Array.isArray(variant) && variant.length > 0;
  const variantStockTotal = hasVariants
    ? variant.reduce((total, item) => total + Number(item?.stock || 0), 0)
    : 0;

  const clearError = (field) => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Fetch tags filtered by category, subcategory and type (auth via http-only cookie)
  useEffect(() => {
    if (!category) {
      setTagList([]);
      setTags([]);
      return;
    }
    setTags([]);
    let cancelled = false;
    // (async () => {
    //   try {
    //     const params = { category };
    //     if (subCategory?.trim()) params.subCategory = subCategory.trim();
    //     if (type?.trim()) params.type = type.trim();
    //     const { data } = await axios.get("/api/shop/tags", {
    //       params,
    //       withCredentials: true,
    //     });
    //     if (!cancelled) setTagList(data?.tags ?? []);
    //   } catch {
    //     if (!cancelled) setTagList([]);
    //   }
    // })();
    return () => { cancelled = true; };
  }, [category, subCategory, type]);

  const updateSubCategory = (data) => {
    setSubCategory(data)
    clearError("subCategory")
  }
  const updateType = (data) => {
    setType(data)
    clearError("type")
  }

  function updateVariantFloater(data){
    setVariant(data)
  }
  // Load main categories on mount
  useEffect(() => {
    const loadedCategories = [];
    for(let x in categories_json){
      loadedCategories.push(x.split("_").join(" & "));
    }
    setCategories(loadedCategories); 
  }, []);

  useEffect(() => {
    const read = () => setScreenWidth(window.innerWidth);
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []); 

  // Load sub-categories when category changes
  useEffect(() => {
    // isMountedRef.current = true;
    
    // Reset sub-categories and type when category changes
    setSubCategories([]);
    setTypeList([]);
    
    if (category !== "" && category !== "fashion") {
      let result;
      
      for(let x in categories_json){
        if(x === category.split(" & ").join("_")){
          result = categories_json[x];
          break;
        }
      }
      
      if (result && result.length > 0) {
        const loadedSubCategories = result.map(sub_category => 
          sub_category.split("_").join(" & ")
        );
        // console.log("loadedSubCategories: ", loadedSubCategories)
        // if (isMountedRef.current) {
          setSubCategories(loadedSubCategories);
        // }
      }
    } else if(category === "fashion"){
      let x = category.split(" & ").join("_");
      let index;
      if(gender.toLowerCase() === 'male'){
        index = 0;
      }else if(gender.toLowerCase() === 'female'){
        index = 1;
      }else{
        index = 2;
      }
      if(categories_json[x] && categories_json[x][index]){
        const loadedType = Object.entries(categories_json[x][index]).map(([key, value]) => key);
        // if (isMountedRef.current) {
        setSubCategories(loadedType);
        // }
      }
    }
    
    // return () => {
    //   isMountedRef.current = false;
    // };
  }, [category, gender]);

  useEffect(() => {
    if (category === "fashion" && gender !== "" && subCategory !== "") {
      let x = category.split(" & ").join("_");
      let index;
      if(gender.toLowerCase() === 'male'){
        index = 0;
      }else if(gender.toLowerCase() === 'female'){
        index = 1;
      }else{
        index = 2;
      }


      if(categories_json[x] && categories_json[x][index] && categories_json[x][index][subCategory]){
        const typeListData = Object.entries(categories_json[x][index][subCategory]).map(([key, value]) => key);
        setTypeList(typeListData);
      }
    }
  }, [category, gender, subCategory])

  let [product_id, set_product_id] = useState('');
  let [shop_id, set_shop_id] = useState('1');
  useEffect(() => {
    if (shopFromQuery != null && String(shopFromQuery).trim() !== "") {
      set_shop_id(String(shopFromQuery).trim())
    }
  }, [shopFromQuery])
  let [category_active, set_category_active] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [finaleModalOpen, setFinaleModalOpen] = useState(false)
  const [fillFormHintOpen, setFillFormHintOpen] = useState(false)

  // Fetch shops for current owner so we have shop_id for product create
  useEffect(() => {
    if (!entrepreneur_id) return
    let cancelled = false
    getShopsByOwner(entrepreneur_id)
      .then((data) => {
        if (cancelled) return
        const shops = data?.shops ?? []
        if (shops.length > 0 && !shop_id) set_shop_id(String(shops[0].id))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [entrepreneur_id])

  // Load product + inventory when editing
  useEffect(() => {
    if (!editId || !shop_id || !entrepreneur_id) {
      if (!editId) setEditLoading(false)
      return
    }
    const shopId = parseInt(shop_id, 10)
    if (isNaN(shopId)) {
      setEditLoading(false)
      return
    }
    let cancelled = false
    setEditLoading(true)
    getProduct(shopId, editId, entrepreneur_id)
      .then((data) => {
        if (cancelled) return
        const p = data?.product
        const inv = data?.inventory ?? []
        if (p) {
          setTitle(p.name ?? "")
          setDescription(p.description ?? "")
          setCategory(p.category != null ? String(p.category) : "")
          setSubCategory(p.subcategory != null ? String(p.subcategory) : "")
          setBrand(p.brand ?? "")
          setTags(Array.isArray(p.tags) ? p.tags : [])

          let rawSpecs = p.specifications
          if (typeof rawSpecs === "string") {
            try {
              rawSpecs = JSON.parse(rawSpecs)
            } catch {
              rawSpecs = {}
            }
          }
          const specs =
            rawSpecs && typeof rawSpecs === "object" && !Array.isArray(rawSpecs)
              ? rawSpecs
              : {}
          setLoadedSpecifications(specs)

          const catNorm = (p.category != null ? String(p.category) : "").trim()
          if (catNorm === "fashion") {
            setGender(specs.gender != null ? String(specs.gender) : "")
            setType(
              specs.type != null
                ? String(specs.type)
                : specs.product_type != null
                  ? String(specs.product_type)
                  : ""
            )
          } else {
            setGender("")
            setType("")
          }

          const rows =
            specs.variants ?? specs.deedyte_variants ?? specs.saved_variants
          if (Array.isArray(rows) && rows.length > 0) {
            setVariant(rows.map((r) => ({ ...r })))
          } else {
            setVariant([])
          }

          const dm = specs.delivery_methods ?? specs.deliveryMethods
          if (dm && typeof dm === "object") {
            setdeliveryMethods({
              pickup: Boolean(dm.pickup),
              delivery: Boolean(dm.delivery),
            })
          }
        }
        if (inv.length > 0) {
          setPrice(String(inv[0].price ?? ""))
          setInventory({ qty: String(inv[0].quantity ?? ""), allow_backorders: Boolean(inv[0].allow_backorder) })
          setLoadedInventoryId(inv[0].id)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setEditLoading(false)
      })
    return () => { cancelled = true }
  }, [editId, shop_id, entrepreneur_id])

  useEffect(() => {
    if (!editId) setLoadedSpecifications({})
  }, [editId])

  useEffect(() => {
    document.body.style.overflow='hidden'
  }, [])

  function upload_data(data) {
    axios.post(`${API_PROXY}/`, {
      name: data.name, 
      value: data.value, 
      product_id, 
      shop_id
    })
    .then((result) => {

    })
    .catch((err) => {
      console.log(err)
    })
  }
  

  function updateTitle(data) {
    setTitle(data)
    clearError("title")
  }

  function updateDescription(data) {
    setDescription(data)
  }

  const updateVariant = useCallback((data) => {
    setVariant(data)
    if (Array.isArray(data) && data.length > 0) {
      setErrors((prev) => {
        if (!prev.quantity) return prev
        const next = { ...prev }
        delete next.quantity
        return next
      })
    }
  }, [])

  function updatePrice(data){
    setPrice(data)
    clearError("price")
  }
  function updateShipping(data){
    setShipping(data)
  }
  const updateInventoryCallback = useCallback((data) => {
    setInventory(data)
    if (String(data?.qty ?? "").trim() !== "" && Number(data?.qty ?? 0) > 0) {
      setErrors((prev) => {
        if (!prev.quantity) return prev
        const next = { ...prev }
        delete next.quantity
        return next
      })
    }
  }, [])

  /**
   * @param {{ omitFinaleFields?: boolean }} [options] — mobile: validate main form before modal (skip brand + delivery; collected in modal).
   */
  function validateForm(options = {}) {
    const omitFinaleFields = options.omitFinaleFields === true;
    const nextErrors = {};
    const normalizedTitle = title.trim();
    const normalizedCategory = category.trim();
    const normalizedGender = gender.trim();
    const normalizedSubCategory = subCategory.trim();
    const normalizedType = type.trim();
    const normalizedBrand = brand.trim();
    const normalizedPrice = String(price ?? "").trim();
    const normalizedQuantity = hasVariants
      ? String(variantStockTotal).trim()
      : String(inventory?.qty ?? "").trim();

    if (!normalizedTitle) nextErrors.title = "Product title is required.";
    if (!normalizedCategory) nextErrors.category = "Category is required.";
    if (normalizedCategory && !normalizedSubCategory) nextErrors.subCategory = "Sub category is required.";
    if (category === "fashion" && !normalizedGender) nextErrors.gender = "Gender is required.";
    if (category === "fashion" && !normalizedType) nextErrors.type = "Type is required.";
    if (!normalizedPrice || Number(normalizedPrice) <= 0) nextErrors.price = "Enter a valid price.";
    if (!normalizedQuantity || Number(normalizedQuantity) <= 0) {
      nextErrors.quantity = hasVariants
        ? "Total variant stock must be greater than 0."
        : "Enter a valid quantity.";
    }
    if (!omitFinaleFields) {
      if (!normalizedBrand) nextErrors.brand = "Brand name is required.";
      if (!deliveryMethods.pickup && !deliveryMethods.delivery) {
        nextErrors.deliveryMethods = "Select at least one delivery method.";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function openMobileFinaleModal() {
    if (!validateForm({ omitFinaleFields: true })) {
      setFillFormHintOpen(true);
      return;
    }
    setFillFormHintOpen(false);
    setFinaleModalOpen(true);
  }

  async function performSave() {
    setSaveError(null)
    setSaveLoading(true)
    try {
      const slug = title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "product"

      const baseSpecs =
        loadedSpecifications &&
        typeof loadedSpecifications === "object" &&
        !Array.isArray(loadedSpecifications)
          ? { ...loadedSpecifications }
          : {}

      /** Raw UI values only — same strings as the selects (gender, type, variants, delivery). */
      const specifications = {
        ...baseSpecs,
        variants: hasVariants ? variant : [],
        delivery_methods: {
          pickup: Boolean(deliveryMethods.pickup),
          delivery: Boolean(deliveryMethods.delivery),
        },
      }
      if (category === "fashion") {
        specifications.gender = gender
        specifications.type = type
      } else {
        delete specifications.gender
        delete specifications.type
      }

      const productPayload = {
        name: title.trim(),
        slug,
        description: description?.trim() || null,
        short_description: (description?.trim() || "").slice(0, 200) || null,
        category: category ? String(category).trim() : null,
        subcategory: subCategory ? String(subCategory).trim() : null,
        brand: brand?.trim() || null,
        images: [],
        videos: [],
        tags: Array.isArray(tags) ? tags : [],
        weight: null,
        dimensions: null,
        specifications,
        status: "draft",
        is_published: false,
        published_at: null,
        is_featured: false,
      }
      const quantity = hasVariants ? Number(variantStockTotal) : Number(String(inventory?.qty ?? "0").replace(/,/g, "")) || 0
      const priceNum = Number(String(price ?? "").replace(/,/g, "")) || 0
      const inventoryPayload = {
        sku: null,
        price: priceNum,
        compare_at_price: null,
        cost_price: null,
        currency: "NGN",
        quantity,
        reserved_quantity: 0,
        low_stock_threshold: 5,
        track_inventory: true,
        allow_backorder: Boolean(inventory?.allow_backorders),
        taxable: true,
        tax_rate: 0,
      }

      if (editId) {
        const productId = parseInt(editId, 10)
        if (isNaN(productId)) throw new Error("Invalid product ID")
        await updateProduct(shop_id, productId, entrepreneur_id, productPayload)
        if (loadedInventoryId) {
          await updateInventory(shop_id, productId, loadedInventoryId, entrepreneur_id, inventoryPayload)
        }
      } else {
        const { product } = await createProduct(shop_id, entrepreneur_id, productPayload)
        await createInventory(shop_id, product.id, entrepreneur_id, inventoryPayload)
      }

      setFinaleModalOpen(false)
      router.push("/entrepreneur/product")
    } catch (err) {
      setSaveError(err?.message || "Failed to save product.")
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleSave() {
    if (!validateForm()) return
    await performSave()
  }

  async function handleMobileFinaleContinue() {
    if (!validateForm()) return
    await performSave()
  }
  


  useEffect(() => {
    if (screenWidth <= 480) {
      document.querySelector(".entrepreneur-content").style.padding = "5px"
    }
  }, [])
  return (
    <>
      <br />
      
      {/* <h6 style={{color: '#000'}}>Product Details</h6> */}
      <div className="product-cnt" id='product-cnt'>

        {/* <h3>Add Products</h3> */}

        <section>
        
          <div className='product-details' style={{width: "100%", borderRadius: "5px"}}>

            <Title updateTitle={updateTitle} editValue={title} error={errors.title} />
            <Description editValue={description} updateDescription={updateDescription} />
            <Image />
            <div className="product-category">
              <div className="input-cnt" style={{flexDirection: 'column', width: "100%", justifyContent: 'flex-start', alignItems: 'flex-start'}}>
                <label htmlFor="">Category</label>
                <select
                  name=""
                  id=""
                  value={category}
                  style={{textTransform: 'capitalize'}}
                  onChange={e => {
                    const value = e.target.value;
                    setCategory(value);
                    clearError("category");
                    setSubCategory("");
                    clearError("subCategory");
                    if (value !== "fashion") {
                      setGender("");
                      setType("");
                      clearError("gender");
                      clearError("type");
                    }
                  }}
                >
                  <option value="">Select a category</option>
                  {
                    categories.map((categoryOpt, index) => (
                      <option key={index} value={categoryOpt}>{categoryOpt}</option>
                    ))
                  }
                </select>
                <div className="err-mssg">{errors.category || ""}</div>
              </div>
              <br />

              {
                category === "fashion" &&
                <div className="input-cnt" style={{flexDirection: 'column', width: "100%", justifyContent: 'flex-start', alignItems: 'flex-start'}}>
                  <label htmlFor="">Gender</label>
                  <select
                    name=""
                    id=""
                    value={gender}
                    style={{textTransform: 'capitalize'}}
                    onChange={e => {
                      setGender(e.target.value);
                      clearError("gender");
                    }}
                  >
                    <option value="">Select your gender</option>
                    {
                      ["male", "female", "unisex"].map((genderOpt, index) => (
                        <option key={genderOpt} value={genderOpt}>{genderOpt}</option>
                      ))
                    }
                  </select>
                  <div className="err-mssg">{errors.gender || ""}</div>
                </div>
              }
            </div>

          </div>
          {/* <br /> */}

          {
            category !== ""&&
            <div className="product-attribute" style={{width: "100%", marginBottom: "10px", borderRadius: "5px"}}>
              <Attribute
                typeList={typeList}
                sub_categories={subCategories}
                category={category}
                sub_category={subCategory}
                type={type}
                updateSubCategory={updateSubCategory}
                updateType={updateType}
                errors={errors}
              />
            </div>
          }
          {/* <br /> */}

          <div style={{ width: "100%" }}>
            <Variant
              category={category}
              subCategory={subCategory}
              type={type}
              updateVariant={updateVariant}
              savedVariantsData={variant}
            />
          </div>
          
          {/* <br /> */}

          <div  style={{width: "100%"}}>
            <Price updatePrice={updatePrice} error={errors.price} defaultPrice={price} />
          </div>
          {/* <br /> */}

          <div className='product-inventory'>
            <Inventory
              updateInventory={updateInventoryCallback}
              error={errors.quantity}
              useVariantQuantity={hasVariants}
              variantQuantity={variantStockTotal}
              defaultQuantity={inventory?.qty}
              defaultAllowBackorders={inventory?.allow_backorders}
            />
          </div>
          {/* <br /> */}

          <div className='product-shipping'>
            <Shipping updateShipping={updateShipping} />
          </div>
          {/* <br /> */}

        </section>

        {screenWidth >= VARIANT_INLINE_MIN_WIDTH ? (
          <section>

            <div className="product-publication" style={{width: "100%"}}>
              <h6 style={{color: '#727272'}}>Product Status</h6>

              {/* <br /> */}

              <div className="input-cnt"  style={{flexDirection: 'column', width: "100%", justifyContent: 'flex-start', alignItems: 'flex-start'}}>
                <label htmlFor="" style={{color: '#727272'}}><small>Status</small></label>
                <select name="" id="" style={{padding: '5px', outline: 'none', color: '#727272'}}>
                    {/* <option value="">Active</option> */}
                    <option value="">Draft</option>
                </select>
                <div className="err-mssg"></div>
              </div>

              {editLoading && (
                <p style={{ color: "#727272", marginBottom: 8 }}>Loading product…</p>
              )}
              {saveError && (
                <div className="err-mssg" style={{ marginBottom: 8 }}>{saveError}</div>
              )}
              <button
                style={{
                  height: "40px",
                  width: "100px",
                  borderRadius: "5px",
                  background: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  cursor: saveLoading || editLoading ? "not-allowed" : "pointer",
                  opacity: saveLoading || editLoading ? 0.7 : 1,
                  position: "absolute",
                  bottom: "20px",
                  right: "10px"
                }}
                onClick={handleSave}
                disabled={saveLoading || editLoading}
              >
                {saveLoading ? (editId ? "Updating…" : "Saving…") : editId ? "Update" : "Save"}
              </button>
              
            </div>

            <br />

            <div className="product-org-cnt" style={{width: "100%"}}>
              <h6 style={{color: '#727272'}}>Product organization</h6>
              {/* <br /> */}
              

              <div className="input-cnt" style={{flexDirection: 'column', width: "100%", justifyContent: 'flex-start', alignItems: 'flex-start'}}>
                <label htmlFor="" style={{color: '#727272'}}>
                  <small>Brand Name (Manufacturer Name)</small>
                </label>
                <input
                  style={{width: '100%', border: '1px solid #727272'}}
                  value={brand}
                  onInput={e => {
                    setBrand(e.target.value);
                    clearError("brand");
                  }}
                  type="text"
                  name=""
                  id=""
                />
                <div className="err-mssg">{errors.brand || ""}</div>
              </div>

              {/* <br /> */}

              {/* <div className="input-cnt" style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start'}}>
                <label htmlFor="" style={{color: '#727272'}}>
                  <small>Tag</small>
                </label>

                <Select
                  isMulti
                  options={tagList.map((t) => ({ value: t.id, label: t.name }))}
                  value={tagList.filter((t) => tags.includes(t.name)).map((t) => ({ value: t.id, label: t.name }))}
                  onChange={(opt) => {
                    const next = opt ? opt.slice(0, 5).map((o) => o.label) : [];
                    setTags(next);
                    clearError("tag");
                  }}
                  placeholder={
                    !category
                      ? "Select a category first"
                      : !subCategory
                      ? "Select a sub-category"
                      : tagList.length === 0
                      ? "No tags for this selection"
                      : "Select up to 5 tags"
                  }
                  isDisabled={!category || !subCategory || tagList.length === 0}
                  isOptionDisabled={() => tags.length >= 5}
                  styles={{
                    container: (base) => ({ ...base, width: "100%" }),
                    control: (base) => ({ ...base, minHeight: 38, width: "100%" }),
                  }}
                />
                <div className="err-mssg">{errors.tag || ""}</div>
                {tags.length > 0 && (
                  <small style={{ color: "#727272", marginTop: 4 }}>
                    {tags.length}/5 tags selected
                  </small>
                )}
              </div> */}

              {/* <br />

              <div className="input-cnt" style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start'}}>
                <label htmlFor="" style={{color: '#727272'}}>
                  <small>Vendor</small>
                </label>
                <input  style={{width: '100%', border: '1px solid #727272'}} type="text" name="" id="" />
              </div> */}

            </div>

            <br />

            <div className="product-publication" style={{height: "fit-content"}}>
              <h6 style={{color: '#727272', marginBottom: "20px"}}>Delivery Methods</h6>

              {/* <br /> */}

              <div className="input-cnt" style={{flexDirection: 'row', width: "100%", justifyContent: 'flex-start', alignItems: 'flex-start', height: "fit-content", marginBottom: "20px"}}>
                <input
                  style={{width: '15px', border: '1px solid #727272', height: '15px'}}
                  type='checkbox'
                  checked={deliveryMethods.pickup}
                  onChange={e => {
                    const checked = e.target.checked;
                    setdeliveryMethods(prev => ({
                      ...prev,
                      pickup: checked,
                    }));
                    if (checked || deliveryMethods.delivery) {
                      clearError("deliveryMethods");
                    }
                  }}
                  name=""
                  id=""
                />
                &nbsp;
                <label style={{margin: '-4px 0 0 0', height: 'fit-content', lineHeight: "20px", color: '#727272'}} htmlFor=""><small>Allow customers to pick up orders from your location</small></label>
              </div>

              <div className="input-cnt" style={{flexDirection: 'row', width: "100%", justifyContent: 'flex-start', alignItems: 'flex-start', height: "fit-content"}}>
                <input
                  style={{width: '15px', border: '1px solid #727272', height: '15px'}}
                  checked={deliveryMethods.delivery}
                  onChange={e => {
                    const checked = e.target.checked;
                    setdeliveryMethods(prev => ({
                      ...prev,
                      delivery: checked,
                    }));
                    if (checked || deliveryMethods.pickup) {
                      clearError("deliveryMethods");
                    }
                  }}
                  type='checkbox'
                  name=""
                  id=""
                />
                &nbsp;
                <label style={{margin: '-4px 0 0 0', height: 'fit-content', lineHeight: "20px", color: '#727272'}} htmlFor=""><small>Deliver orders to the customer&apos;s address</small></label>
              </div>
              <div className="err-mssg">{errors.deliveryMethods || ""}</div>

              {/* <br />

              <div className="input-cnt" style={{flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center'}}>
                <input style={{width: '15px', border: '1px solid #727272', height: '15px'}} placeholder='Product price' type='checkbox' name="" id="" />
                &nbsp;
                <label style={{margin: '-8px 0 0 0', height: '15px', color: '#727272'}} htmlFor=""><small>Point Of Sale</small></label>
              </div>
              <br />
              <small style={{color: '#727272', fontSize: 'small'}}>Point of Sale has not been set up. Finish the remaining steps to start selling in person.</small>

  */}

            </div>
          </section>
        ) : null}

        {screenWidth > 0 && screenWidth <= MOBILE_MAX_WIDTH ? (
          <SaveBtn
            onClick={openMobileFinaleModal}
            disabled={editLoading}
            label="Save"
          />
        ) : null}

        <FillFormHintModal
          open={fillFormHintOpen && screenWidth > 0 && screenWidth <= MOBILE_MAX_WIDTH}
          onClose={() => setFillFormHintOpen(false)}
        />

        <SubmissionFinaleModal
          open={finaleModalOpen && screenWidth > 0 && screenWidth <= MOBILE_MAX_WIDTH}
          onClose={() => {
            if (!saveLoading) setFinaleModalOpen(false)
          }}
          brand={brand}
          onBrandChange={setBrand}
          deliveryMethods={deliveryMethods}
          onDeliveryMethodsChange={setdeliveryMethods}
          errors={errors}
          clearError={clearError}
          onContinue={handleMobileFinaleContinue}
          saveLoading={saveLoading}
          editLoading={editLoading}
          saveError={saveError}
          isEdit={Boolean(editId)}
        />

        {/* <section>
          <button>
            
          </button>
        </section> */}

      </div>
    </>
  )
}
