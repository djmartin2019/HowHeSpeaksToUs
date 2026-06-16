/**
 * Client-side pagination and tag filtering for static list pages.
 * Configure via #list-pagination-config JSON script tag.
 *
 * compactPagination: true — First / Previous / Page X of Y / Next / Last (mobile-friendly)
 */
(function () {
  "use strict";

  var ACTIVE_PAGE_BTN =
    "px-3 py-2 text-sm font-medium transition-colors pagination-btn bg-black text-white border-2 border-black";
  var INACTIVE_PAGE_BTN =
    "px-3 py-2 text-sm font-medium transition-colors pagination-btn text-black bg-white border-2 border-gray-300 hover:border-black";
  var TAG_ACTIVE =
    "px-4 py-2 rounded-full text-sm font-medium transition-colors bg-white text-black border-2 border-white";
  var TAG_INACTIVE =
    "px-4 py-2 rounded-full text-sm font-medium transition-colors bg-transparent text-gray-300 border border-gray-600 hover:border-white hover:text-white";

  function readConfig() {
    var el = document.getElementById("list-pagination-config");
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || "{}");
    } catch (e) {
      console.error("Invalid list-pagination config:", e);
      return null;
    }
  }

  function initListPagination(config) {
    var itemSelector = config.itemSelector;
    var limit = config.limit || 9;
    var resultsAll = config.resultsAll || "Showing all items";
    var resultsTagged = config.resultsTagged || "Showing items tagged with";
    var grid = config.gridId ? document.getElementById(config.gridId) : null;
    var compactPagination = config.compactPagination === true;
    var tagCollapse = config.tagCollapse === true;
    var tagsExpanded = false;
    var applyTagCollapse = function () {};

    function initTagCollapse() {
      if (!tagCollapse) return;

      var toggleBtn = document.getElementById("tag-show-all-btn");
      var extraTags = document.querySelectorAll(".tag-filter-extra");
      if (!toggleBtn || extraTags.length === 0) return;

      var selectedTags = getSelectedTags();
      tagsExpanded = Array.from(extraTags).some(function (btn) {
        var tagName = btn.getAttribute("data-tag");
        return tagName !== null && selectedTags.includes(tagName);
      });

      applyTagCollapse = function () {
        extraTags.forEach(function (btn) {
          btn.classList.toggle("hidden", !tagsExpanded);
        });
        toggleBtn.setAttribute("aria-expanded", tagsExpanded ? "true" : "false");
        toggleBtn.textContent = tagsExpanded
          ? "Show fewer categories"
          : "Show all categories";
      };

      applyTagCollapse();

      toggleBtn.addEventListener("click", function () {
        tagsExpanded = !tagsExpanded;
        applyTagCollapse();
      });
    }

    function getSelectedTags() {
      var params = new URLSearchParams(window.location.search);
      var tagParam = params.get("tag") || "";
      return tagParam
        ? tagParam
            .split(",")
            .map(function (t) {
              return t.trim();
            })
            .filter(function (t) {
              return t;
            })
        : [];
    }

    function getFilteredItems() {
      var selectedTags = getSelectedTags();
      var allItems = Array.from(document.querySelectorAll(itemSelector));

      if (selectedTags.length === 0) {
        return allItems;
      }

      return allItems.filter(function (item) {
        var itemTags = item.getAttribute("data-tags") || "";
        var tags = itemTags
          ? itemTags.split(",").map(function (t) {
              return t.trim();
            })
          : [];
        return selectedTags.some(function (tag) {
          return tags.includes(tag);
        });
      });
    }

    function getTotalPages() {
      var filteredItems = getFilteredItems();
      return Math.max(1, Math.ceil(filteredItems.length / limit));
    }

    function getCurrentPage() {
      var params = new URLSearchParams(window.location.search);
      var page = parseInt(params.get("page") || "1", 10);
      var totalPages = getTotalPages();
      return Math.max(1, Math.min(page, totalPages));
    }

    function updateURL(page, tags) {
      var url = new URL(window.location.href);
      if (page === 1) {
        url.searchParams.delete("page");
      } else {
        url.searchParams.set("page", page.toString());
      }
      if (tags.length === 0) {
        url.searchParams.delete("tag");
      } else {
        url.searchParams.set("tag", tags.join(","));
      }
      window.history.pushState({ page: page, tags: tags }, "", url.toString());
    }

    function setButtonDisabled(btn, disabled) {
      if (!btn) return;
      btn.disabled = disabled;
    }

    function showPage(page) {
      var selectedTags = getSelectedTags();
      var filteredItems = getFilteredItems();
      var totalItems = filteredItems.length;
      var totalPages = Math.max(1, Math.ceil(totalItems / limit));

      document.querySelectorAll(itemSelector).forEach(function (item) {
        item.style.display = "none";
      });

      var startIndex = (page - 1) * limit;
      var endIndex = startIndex + limit;

      filteredItems.forEach(function (item, index) {
        if (index >= startIndex && index < endIndex) {
          item.style.display = "";
        }
      });

      var resultsCount = document.getElementById("results-count");
      if (resultsCount) {
        var tagText =
          selectedTags.length > 0
            ? resultsTagged + ' "' + selectedTags.join('", "') + '"'
            : resultsAll;
        resultsCount.textContent = tagText + " (" + totalItems + " total)";
      }

      if (grid) {
        grid.setAttribute("data-total-items", totalItems.toString());
        grid.setAttribute("data-total-pages", totalPages.toString());
      }

      var paginationNav = document.getElementById("pagination-nav");
      if (paginationNav && totalPages > 1) {
        paginationNav.style.display = "";

        var prevBtn = document.getElementById("prev-btn");
        var nextBtn = document.getElementById("next-btn");

        if (compactPagination) {
          var firstBtn = document.getElementById("first-btn");
          var lastBtn = document.getElementById("last-btn");
          var pageIndicator = document.getElementById("page-indicator");

          setButtonDisabled(firstBtn, page <= 1);
          setButtonDisabled(prevBtn, page <= 1);
          setButtonDisabled(nextBtn, page >= totalPages);
          setButtonDisabled(lastBtn, page >= totalPages);

          if (pageIndicator) {
            pageIndicator.textContent = "Page " + page + " of " + totalPages;
          }
        } else {
          if (prevBtn) {
            prevBtn.style.display = page > 1 ? "" : "none";
          }
          if (nextBtn) {
            nextBtn.style.display = page < totalPages ? "" : "none";
          }

          var pageBtns = document.querySelectorAll(".pagination-btn");
          pageBtns.forEach(function (btn) {
            var btnPage = parseInt(btn.getAttribute("data-page") || "1", 10);
            if (btnPage > totalPages) {
              btn.style.display = "none";
              btn.removeAttribute("aria-current");
            } else {
              btn.style.display = "";
              if (btnPage === page) {
                btn.className = ACTIVE_PAGE_BTN;
                btn.setAttribute("aria-current", "page");
              } else {
                btn.className = INACTIVE_PAGE_BTN;
                btn.removeAttribute("aria-current");
              }
            }
          });
        }
      } else if (paginationNav) {
        paginationNav.style.display = "none";
      }
    }

    function updateTagButtons() {
      var selectedTags = getSelectedTags();
      var allBtn = document.getElementById("tag-all");
      var tagBtns = document.querySelectorAll('[data-tag]:not([data-tag="all"])');

      if (allBtn) {
        allBtn.className = selectedTags.length === 0 ? TAG_ACTIVE : TAG_INACTIVE;
        allBtn.setAttribute("aria-pressed", selectedTags.length === 0 ? "true" : "false");
      }

      tagBtns.forEach(function (btn) {
        var tagName = btn.getAttribute("data-tag");
        var isSelected = tagName !== null && selectedTags.includes(tagName);
        var isExtra = btn.classList.contains("tag-filter-extra");
        btn.className =
          (isSelected ? TAG_ACTIVE : TAG_INACTIVE) +
          (isExtra ? " tag-filter-extra" : "");
        btn.setAttribute("aria-pressed", isSelected ? "true" : "false");
      });

      if (tagCollapse) {
        var extraTags = document.querySelectorAll(".tag-filter-extra");
        var shouldExpand = Array.from(extraTags).some(function (btn) {
          var tagName = btn.getAttribute("data-tag");
          return tagName !== null && selectedTags.includes(tagName);
        });
        if (shouldExpand) {
          tagsExpanded = true;
        }
        applyTagCollapse();
      }
    }

    function goToPage(page) {
      var selectedTags = getSelectedTags();
      var totalPages = getTotalPages();
      var targetPage = Math.max(1, Math.min(page, totalPages));
      updateURL(targetPage, selectedTags);
      showPage(targetPage);
      updateTagButtons();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function init() {
      initTagCollapse();
      showPage(getCurrentPage());
      updateTagButtons();

      var prevBtn = document.getElementById("prev-btn");
      var nextBtn = document.getElementById("next-btn");

      if (compactPagination) {
        var firstBtn = document.getElementById("first-btn");
        var lastBtn = document.getElementById("last-btn");

        if (firstBtn) {
          firstBtn.addEventListener("click", function () {
            goToPage(1);
          });
        }

        if (prevBtn) {
          prevBtn.addEventListener("click", function () {
            var page = getCurrentPage();
            if (page > 1) {
              goToPage(page - 1);
            }
          });
        }

        if (nextBtn) {
          nextBtn.addEventListener("click", function () {
            var page = getCurrentPage();
            if (page < getTotalPages()) {
              goToPage(page + 1);
            }
          });
        }

        if (lastBtn) {
          lastBtn.addEventListener("click", function () {
            goToPage(getTotalPages());
          });
        }
      } else {
        var pageBtns = document.querySelectorAll(".pagination-btn");

        if (prevBtn) {
          prevBtn.addEventListener("click", function () {
            var page = getCurrentPage();
            if (page > 1) {
              goToPage(page - 1);
            }
          });
        }

        if (nextBtn) {
          nextBtn.addEventListener("click", function () {
            var page = getCurrentPage();
            if (page < getTotalPages()) {
              goToPage(page + 1);
            }
          });
        }

        pageBtns.forEach(function (btn) {
          btn.addEventListener("click", function () {
            var page = parseInt(btn.getAttribute("data-page") || "1", 10);
            if (page <= getTotalPages()) {
              goToPage(page);
            }
          });
        });
      }

      var allBtn = document.getElementById("tag-all");
      var tagBtns = document.querySelectorAll('[data-tag]:not([data-tag="all"])');

      if (allBtn) {
        allBtn.addEventListener("click", function () {
          updateURL(1, []);
          showPage(1);
          updateTagButtons();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      }

      tagBtns.forEach(function (btn) {
        btn.addEventListener("click", function () {
          var tagName = btn.getAttribute("data-tag");
          if (!tagName) return;
          var currentTags = getSelectedTags();
          var newTags = currentTags.includes(tagName)
            ? currentTags.filter(function (t) {
                return t !== tagName;
              })
            : currentTags.concat([tagName]);

          updateURL(1, newTags);
          showPage(1);
          updateTagButtons();
          window.scrollTo({ top: 0, behavior: "smooth" });
        });
      });

      window.addEventListener("popstate", function () {
        showPage(getCurrentPage());
        updateTagButtons();
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  var config = readConfig();
  if (config) {
    initListPagination(config);
  }
})();
